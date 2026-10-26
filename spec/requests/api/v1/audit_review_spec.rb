# frozen_string_literal: true

require 'rails_helper'

# Fixes from the second pass over the 2026-10-15 audit: ids a client may not
# borrow, what a pending invitee sees, what deleting a post or account does,
# and what clearing notifications keeps.
RSpec.describe 'Audit review fixes' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def mate!(one, two)
    one.account.follow!(two.account)
    two.account.follow!(one.account)
  end

  describe 'a nudge' do
    let(:carol) { Fabricate(:account) }

    it "keeps only the sender's own photo and a nudge between the two" do
      carols_photo = Fabricate(:media_attachment, account: carol)
      others_nudge = NudgeService.new.call(carol, Fabricate(:account), text: 'private')
      earlier = NudgeService.new.call(bob.account, alice.account, text: 'hi')

      borrowed = NudgeService.new.call(alice.account, bob.account, text: 'look', media_attachment_id: carols_photo.id, voice_attachment_id: carols_photo.id, in_reply_to_notification_id: others_nudge.id)
      reply = NudgeService.new.call(alice.account, bob.account, text: 'back', in_reply_to_notification_id: earlier.id)

      expect(borrowed.nudge_message).to have_attributes(media_attachment_id: nil, voice_attachment_id: nil, in_reply_to_notification_id: nil)
      expect(reply.nudge_message.in_reply_to_notification_id).to eq earlier.id
    end

    it 'with a message survives Clear notifications' do
      nudge = NudgeService.new.call(alice.account, bob.account, text: 'hello')
      plain = Fabricate(:notification, account: bob.account, type: :follow, activity: Fabricate(:follow, target_account: bob.account))

      post '/api/v1/notifications/clear', headers: headers_for(bob)

      expect(response).to have_http_status(200)
      expect(Notification.exists?(plain.id)).to be false
      expect(NudgeMessage.exists?(notification_id: nudge.id)).to be true
    end
  end

  describe 'a pending Krew-chat invite' do
    it 'lists the request without what is being said' do
      krew = Krew.create!(slug: 'growers', name: 'Growers', access: 'open')
      krew.krew_memberships.create!(account: alice.account, role: 'seeder', source: 'direct')
      conversation = Nudges::Conversation.invite_to_krew!(krew, bob.account, alice.account)
      conversation.messages.create!(author_account_id: alice.account.id, body: 'the secret plan')

      get '/api/v1/nudges/conversations', headers: headers_for(bob)

      row = response.parsed_body.find { |c| c['id'] == conversation.id.to_s }
      expect(row).to include('request' => true, 'preview' => '')
      expect(response.body).to_not include('secret plan')
    end
  end

  describe 'a published trek whose post is deleted' do
    let(:trek) do
      trek = Trek.create!(account: alice.account, recorded_at: Time.zone.now)
      post "/api/v1/map/treks/#{trek.id}/publish", params: { visibility: 'self_only' }, headers: headers_for(alice)
      trek.reload
    end

    before { mate!(alice, bob) }

    it 'stays hidden from Mates once the post is deleted' do
      trek.status.discard

      get "/api/v1/map/treks/#{trek.id}", headers: headers_for(bob)
      expect(response).to have_http_status(404)
    end

    it 'is a draft again once the post is destroyed' do
      trek.status.destroy!

      expect(trek.reload).to have_attributes(state: 'draft', status_id: nil)
      get "/api/v1/map/treks/#{trek.id}", headers: headers_for(bob)
      expect(response).to have_http_status(404)
    end
  end

  it 'hides profile content from someone the owner blocked' do
    mate!(alice, bob)
    expect(ProfileVisibility.reach_allows?('mates', owner: alice.account, viewer: bob.account)).to be true

    alice.account.block!(bob.account)

    expect(ProfileVisibility.reach_allows?('public', owner: alice.account, viewer: bob.account)).to be false
    expect(alice.account.profile_visible_to?(bob.account)).to be false
  end

  it 'refuses a reaction in a Mate chat closed by a block' do
    conversation = Nudges::Conversation.mate_between!(alice.account, bob.account)
    message = conversation.messages.create!(author_account_id: alice.account.id, body: 'hi')
    alice.account.block!(bob.account)

    post "/api/v1/nudges/conversations/#{conversation.id}/messages/#{message.id}/reactions", params: { symbol: '👍' }, headers: headers_for(bob)

    expect(response).to have_http_status(403)
  end

  it "lets a proposer's account go even when others commented on the proposal" do
    proposal = Fabricate(:proposal, created_by_account: alice.account)
    ProposalComment.create!(proposal: proposal, account: bob.account, body: 'Count me in')

    expect { alice.account.delete }.to_not raise_error
    expect(Proposal.exists?(proposal.id)).to be false
  end

  it "reads Inflow's note through a pooled cache connection" do
    store = {}
    connection = Class.new do
      define_method(:get) { |key| store[key] }
      define_method(:setex) { |key, _ttl, value| store[key] = value }
    end.new
    pooled = instance_double(ActiveSupport::Cache::RedisCacheStore, redis: ConnectionPool.new(size: 1) { connection }, clear: nil)
    allow(Rails).to receive(:cache).and_return(pooled)
    allow(NatureObservationGenerator).to receive_messages(fetch_weather: nil, fetch_recent_sightings: [], build_prompt: 'prompt', call_claude: 'A wren.')

    NatureObservationGenerator.generate!(Time.zone.today)

    expect(NatureObservationGenerator.fetch(Time.zone.today)).to eq 'A wren.'
  end
end
