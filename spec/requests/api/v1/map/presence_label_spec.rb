# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/map.md, Updating from Anthemos: the phone sends only where it is.
RSpec.describe 'Map presence label' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  it 'names a pin sent without a label for its town' do
    allow(Kronk::Geocoder).to receive(:reverse).and_return('Fremantle, Australia')

    post '/api/v1/map/presence', headers: headers, params: { lat: -32.05, lng: 115.75, precision: 'city' }

    expect(response).to have_http_status(200)
    expect(PresenceState.find_by(account_id: user.account_id).label).to eq 'Fremantle, Australia'
  end

  it 'keeps a label it is given, without looking one up' do
    allow(Kronk::Geocoder).to receive(:reverse)

    post '/api/v1/map/presence', headers: headers, params: { lat: -32.05, lng: 115.75, precision: 'city', label: 'Freo' }

    expect(PresenceState.find_by(account_id: user.account_id).label).to eq 'Freo'
    expect(Kronk::Geocoder).to_not have_received(:reverse)
  end
end
