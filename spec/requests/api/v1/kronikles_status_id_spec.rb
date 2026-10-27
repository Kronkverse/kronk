# frozen_string_literal: true

require 'rails_helper'

# The Kronikles reader puts the shared reactions bar (StatusEngagement) on a
# Kronikle's backing Status, so the API names it: `status_id`.
RSpec.describe 'API V1 Kronikles status_id' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  it 'names the Status a published Kronikle rides on' do
    post '/api/v1/kronikles/chronicles', headers: headers, params: {
      chronicle: { title: 'Harvest story', body: 'It rained.', kind: 'essay', visibility: 'public' },
    }
    expect(response).to have_http_status(201)

    chronicle = Chronicle.find(response.parsed_body['id'])
    expect(chronicle.status_id).to be_present
    expect(response.parsed_body['status_id']).to eq(chronicle.status_id.to_s)

    get "/api/v1/kronikles/chronicles/#{chronicle.id}", headers: headers
    expect(response.parsed_body['status_id']).to eq(chronicle.status_id.to_s)
  end

  it 'is null for a Kronikle with no Status' do
    chronicle = Chronicle.create!(owner: user.account, title: 'Notes', body: 'Unposted.', visibility: :public)

    get "/api/v1/kronikles/chronicles/#{chronicle.id}", headers: headers

    expect(response.parsed_body['status_id']).to be_nil
  end
end
