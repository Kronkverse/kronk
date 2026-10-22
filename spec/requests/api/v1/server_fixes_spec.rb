# frozen_string_literal: true

require 'rails_helper'

# Server bugs from the 2026-10-15 audit: proposals, events, Huddle, Krews,
# listings, the home page and account deletion.
RSpec.describe 'Server fixes' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  describe 'proposals' do
    let(:proposal) { Fabricate(:proposal, created_by_account: alice.account) }

    it 'does not take a stake once the proposal is annulled' do
      Kronk::ProposalStates.annul!(proposal)

      expect { Kronk::Tokens.back!(bob.account, proposal, 1) }.to raise_error(Kronk::Tokens::NotBackable)
    end

    it 'closes voting on a closed or annulled proposal' do
      Kronk::ProposalStates.annul!(proposal)

      post "/api/v1/proposals/#{proposal.id}/vote", params: { vote: { position: 'agree' } }, headers: headers_for(bob)

      expect(response).to have_http_status(422)
    end

    it "annuls a deleted proposer's open proposals, returning the stakes" do
      Kronk::Tokens.grant!(bob.account, 5)
      before = Kronk::Tokens.balance_of(bob.account)
      Kronk::Tokens.back!(bob.account, proposal, 3)

      DeleteAccountService.new.call(alice.account)

      expect(proposal.reload.status).to eq 'annulled'
      expect(Kronk::Tokens.balance_of(bob.account)).to eq before
    end
  end

  describe 'events' do
    # Made through the API, so it has its post and others may see it.
    let(:event) do
      post '/api/v1/events', params: { title: 'Picnic', start_time: 1.day.from_now.iso8601, visibility: 'public' }, headers: headers_for(alice)
      Event.find(response.parsed_body['id'])
    end

    it 'deletes an event that has RSVPs' do
      event.rsvps.create!(account: bob.account, status: :going)

      delete "/api/v1/events/#{event.id}", headers: headers_for(alice)

      expect(response).to have_http_status(200)
      expect(Event.exists?(event.id)).to be false
    end

    it 'takes the post out when the event turns invite-only, and posts it again when it turns back' do
      post '/api/v1/events', params: { title: 'Party', start_time: 2.days.from_now.iso8601, visibility: 'public' }, headers: headers_for(alice)
      created = Event.find(response.parsed_body['id'])
      first_post = created.status

      put "/api/v1/events/#{created.id}", params: { invite_only: true }, headers: headers_for(alice)
      expect(created.reload.status).to be_nil
      expect(Status.exists?(first_post.id)).to be false

      put "/api/v1/events/#{created.id}", params: { invite_only: false }, headers: headers_for(alice)
      expect(created.reload.status).to be_present
    end

    it 'refuses a going RSVP once the event is full' do
      event.update!(max_attendees: 1)
      event.rsvps.create!(account: Fabricate(:account), status: :going)

      post "/api/v1/events/#{event.id}/rsvp", params: { status: 'going' }, headers: headers_for(bob)

      expect(response).to have_http_status(422)
    end

    it 'refuses an RSVP when RSVPs are off' do
      event.update!(rsvp_enabled: false)

      post "/api/v1/events/#{event.id}/rsvp", params: { status: 'interested' }, headers: headers_for(bob)

      expect(response).to have_http_status(422)
    end
  end

  describe 'Huddle rooms' do
    it 'are marked active when someone goes in' do
      room = HuddleRoom::CreateService.new.call(account: alice.account, name: 'Lounge', description: '', icon: nil)
      room.update_column(:last_active_at, 1.month.ago)

      post "/api/v1/huddle/rooms/#{room.id}/join", headers: headers_for(bob)

      expect(response).to have_http_status(200)
      expect(room.reload.last_active_at).to be > 1.minute.ago
    end

    it 'tell only the host they host it' do
      room = HuddleRoom::CreateService.new.call(account: alice.account, name: 'Lounge', description: '', icon: nil)

      get '/api/v1/huddle/rooms', headers: headers_for(alice)
      expect(response.parsed_body.find { |r| r['id'] == room.id.to_s }['is_host']).to be(true)

      get '/api/v1/huddle/rooms', headers: headers_for(bob)
      expect(response.parsed_body.find { |r| r['id'] == room.id.to_s }['is_host']).to be(false)
    end
  end

  describe 'Krews' do
    let(:krew) { Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: alice.account) }

    before { krew.krew_memberships.create!(account: alice.account, role: 'seeder', source: 'direct') }

    it "archives the Krew when its last member leaves through the Krew's chat" do
      conversation = Nudges::Conversation.krew_for!(krew)

      post "/api/v1/nudges/conversations/#{conversation.id}/leave", headers: headers_for(alice)

      expect(response).to have_http_status(204)
      expect(krew.member?(alice.account)).to be false
      expect(krew.reload.archived?).to be true
    end

    it "can't be joined once archived" do
      krew.update!(archived_at: Time.current)

      post "/api/v1/krews/#{krew.id}/join", headers: headers_for(bob)

      expect(response).to have_http_status(422)
    end

    it 'gives the seat back when a member account is destroyed' do
      krew.krew_memberships.create!(account: bob.account, source: 'direct')
      expect(krew.reload.member_count).to eq 2

      bob.account.destroy!

      expect(krew.reload.member_count).to eq 1
    end
  end

  describe 'Wachuneed listings' do
    it "can't be moved back from closed" do
      listing = Listing.create!(account: alice.account, title: 'Bike', category: 'goods', state: 'live')
      listing.close!

      put "/api/v1/wachuneed/listings/#{listing.id}", params: { state: 'live' }, headers: headers_for(alice)

      expect(response).to have_http_status(422)
      expect(listing.reload.state).to eq 'closed'
    end

    it 'stamps closed_at when closed by update' do
      listing = Listing.create!(account: alice.account, title: 'Bike', category: 'goods', state: 'live')

      listing.update!(state: 'closed')

      expect(listing.closed_at).to be_present
    end
  end

  describe 'the home page asked for as JSON' do
    it 'answers 406, not 500' do
      get '/', headers: { 'Accept' => 'application/json' }

      expect(response).to have_http_status(406)
    end
  end
end
