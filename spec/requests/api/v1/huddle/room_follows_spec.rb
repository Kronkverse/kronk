# frozen_string_literal: true

require 'rails_helper'

# Following a Kuddle (a Huddle Room; docs/spaces/huddle.md, Following a
# Kuddle): its maker follows it, anyone can Follow or Unfollow, and a Krew
# its maker Konnected it to follows it without a row, until they Unfollow.
RSpec.describe 'Following Kuddles' do
  let(:maker) { Fabricate(:user).account }
  let(:user)  { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:krew) { Krew.create!(slug: 'embers', name: 'Embers', access: 'open') }
  let(:room) { HuddleRoom::CreateService.new.call(account: maker, name: 'Ember') }

  before { Kronk::KornerRegistry.reload! }

  def listed(id)
    get '/api/v1/huddle/rooms', headers: headers
    response.parsed_body.find { |r| r['id'] == id.to_s }
  end

  def krew_kuddle
    krew.krew_memberships.create!(account: maker)
    HuddleRoom::CreateService.new.call(account: maker, name: 'Ember', krew: krew)
  end

  it 'has its maker follow a new Kuddle' do
    post '/api/v1/huddle/rooms', headers: headers, params: { name: 'Quiet study' }

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to include('followed' => true, 'followed_via_krew' => false)
    expect(HuddleFollow.find_by(account: user.account, huddle_session_id: response.parsed_body['id'])).to have_attributes(following: true)
  end

  it 'is not followed by someone who has not chosen to' do
    expect(listed(room.id)).to include('followed' => false, 'followed_via_krew' => false)
  end

  it 'follows and unfollows' do
    post "/api/v1/huddle/rooms/#{room.id}/follow", headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body['followed']).to be(true)
    expect(listed(room.id)['followed']).to be(true)

    post "/api/v1/huddle/rooms/#{room.id}/unfollow", headers: headers

    expect(response.parsed_body['followed']).to be(false)
    expect(listed(room.id)['followed']).to be(false)
  end

  it 'keeps one row per person however often they press it' do
    2.times { post "/api/v1/huddle/rooms/#{room.id}/follow", headers: headers }

    expect(HuddleFollow.where(account: user.account, huddle_session: room).count).to eq 1
  end

  it 'needs the write scope' do
    read_only = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read')

    post "/api/v1/huddle/rooms/#{room.id}/follow", headers: { 'Authorization' => "Bearer #{read_only.token}" }

    expect(response).to have_http_status(403)
  end

  it 'cannot follow a retired Kuddle or the Main Huddle' do
    room.retire!
    post "/api/v1/huddle/rooms/#{room.id}/follow", headers: headers
    expect(response).to have_http_status(404)

    main = HuddleSession.main_scope.first || HuddleSession.create!(scope: 'main', title: 'Huddle', session_url: 'huddle', state: 'live', host_account: maker)
    post "/api/v1/huddle/rooms/#{main.id}/follow", headers: headers
    expect(response).to have_http_status(404)
  end

  context 'with a Krew Kuddle' do
    let!(:kuddle) { krew_kuddle }

    it 'is followed by every member of the Krew, with no row for them' do
      krew.krew_memberships.create!(account: user.account)

      expect(listed(kuddle.id)).to include('followed' => true, 'followed_via_krew' => true)
      expect(HuddleFollow.where(account: user.account)).to be_empty
    end

    it 'is not followed by someone outside the Krew' do
      expect(listed(kuddle.id)).to include('followed' => false, 'followed_via_krew' => false)
    end

    it "keeps a member's Unfollow as a choice, and Follow undoes it" do
      krew.krew_memberships.create!(account: user.account)

      post "/api/v1/huddle/rooms/#{kuddle.id}/unfollow", headers: headers

      expect(response.parsed_body).to include('followed' => false, 'followed_via_krew' => true)
      expect(HuddleFollow.find_by(account: user.account, huddle_session: kuddle)).to have_attributes(following: false)
      expect(Huddle::Follows.follower_ids(kuddle)).to_not include(user.account.id)

      post "/api/v1/huddle/rooms/#{kuddle.id}/follow", headers: headers

      expect(response.parsed_body['followed']).to be(true)
      expect(Huddle::Follows.follower_ids(kuddle)).to include(user.account.id)
    end

    it 'stops being followed by someone who leaves the Krew' do
      membership = krew.krew_memberships.create!(account: user.account)
      membership.destroy!

      expect(listed(kuddle.id)['followed']).to be(false)
    end

    it 'is no longer a Krew Kuddle once the Krew is archived' do
      krew.krew_memberships.create!(account: user.account)
      krew.update!(archived_at: Time.current)

      expect(listed(kuddle.id)['followed']).to be(false)
    end
  end

  it 'does not make a Krew Kuddle from a link someone else made' do
    other = Fabricate(:user).account
    krew.krew_memberships.create!(account: other)
    krew.krew_memberships.create!(account: user.account)
    Kronk::AttachmentEffects.link!('huddle', room.id, 'krew', krew.id, other)

    expect(listed(room.id)).to include('followed' => false, 'followed_via_krew' => false)
    expect(Huddle::Follows.follower_ids(room)).to contain_exactly(maker.id)
  end
end
