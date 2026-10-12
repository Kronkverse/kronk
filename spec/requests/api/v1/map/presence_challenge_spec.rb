# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Map presence challenge' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:ana)     { Fabricate(:account, username: 'ana') }
  let(:events)  { [] }

  def place(account)
    PresenceState.place!(account, raw_lat: -33.87, raw_lng: 151.21, precision: 'city', scope: 'friends', label: 'Sydney')
  end

  before do
    allow(Kronk::KornerEvents).to receive(:publish) { |name, **payload| events << [name, payload] }
  end

  context 'with a Mate who has a pin' do
    before do
      me.follow!(ana)
      ana.follow!(me)
      place(ana)
    end

    it 'tells them, by name, once' do
      post "/api/v1/map/presence/#{ana.id}/challenge", headers: headers

      expect(response).to have_http_status(204)
      expect(events).to eq([['map.pin.challenged', { actor_account_id: me.id, recipient_account_id: ana.id }]])
    end

    it 'refuses a second one inside the week, and lets one through after it' do
      post "/api/v1/map/presence/#{ana.id}/challenge", headers: headers
      post "/api/v1/map/presence/#{ana.id}/challenge", headers: headers

      expect(response).to have_http_status(409)
      expect(events.size).to eq(1)

      travel_to(8.days.from_now) do
        redis.del("map:challenge:#{me.id}:#{ana.id}") # Redis does not follow travel_to
        post "/api/v1/map/presence/#{ana.id}/challenge", headers: headers
      end

      expect(response).to have_http_status(204)
    end

    it 'marks the pin as asked in the list' do
      get '/api/v1/map/presence', headers: headers
      expect(response.parsed_body.first[:challenged]).to be(false)

      post "/api/v1/map/presence/#{ana.id}/challenge", headers: headers
      get '/api/v1/map/presence', headers: headers

      expect(response.parsed_body.first[:challenged]).to be(true)
    end
  end

  it 'does not work on a pin you cannot see' do
    place(ana)

    post "/api/v1/map/presence/#{ana.id}/challenge", headers: headers

    expect(response).to have_http_status(404)
    expect(events).to be_empty
  end

  it 'routes the event to a notification that opens the place search' do
    entry = Kronk::KornerRegistry.find('nudges').listens.find { |e| e.is_a?(Hash) && e['event'] == 'map.pin.challenged' }

    expect(entry).to include('source_korner' => 'map', 'verb' => 'challenged', 'cta_route' => '/hub/map?place=1')
  end
end
