# frozen_string_literal: true

require 'rails_helper'

# Who is in a call before joining: Kronk asks the Jitsi server, which answers
# only Kronk (docs/spaces/huddle.md, Jitsi server).
RSpec.describe 'API V1 Calls Presence' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:room_url) { "https://#{Rails.configuration.x.kronk_jitsi_domain}/room" }
  let(:room_query) { { room: 'huddle', domain: 'meet.jitsi' } }

  before { Rails.cache.clear && Kronk::HuddleCount.redis.del('huddle:who:huddle') }

  it 'lists who is in the Main Huddle', :aggregate_failures do
    stub_request(:get, room_url).with(query: room_query).to_return(status: 200, body: [{ display_name: 'Ember' }, { display_name: '' }].to_json)

    get '/api/v1/calls/presence', params: { kind: 'huddle' }, headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to eq('names' => ['Ember'], 'count' => 1)
  end

  it 'reads an empty room as nobody' do
    stub_request(:get, room_url).with(query: room_query).to_return(status: 404)

    get '/api/v1/calls/presence', params: { kind: 'huddle' }, headers: headers

    expect(response.parsed_body).to eq('names' => [], 'count' => 0)
  end

  it 'says nothing when Jitsi can not answer' do
    stub_request(:get, room_url).with(query: room_query).to_return(status: 500)

    get '/api/v1/calls/presence', params: { kind: 'huddle' }, headers: headers

    expect(response.parsed_body).to eq('names' => nil, 'count' => nil)
  end

  it 'is 404 for a live set the viewer can not see' do
    live = Fabricate(:booth_live, visibility: :self_only)

    get '/api/v1/calls/presence', params: { kind: 'booth_live', id: live.id }, headers: headers

    expect(response).to have_http_status(404)
  end

  it 'needs a signed-in member' do
    get '/api/v1/calls/presence', params: { kind: 'huddle' }

    expect(response).to have_http_status(401)
  end
end
