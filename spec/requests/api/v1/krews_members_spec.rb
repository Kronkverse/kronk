# frozen_string_literal: true

require 'rails_helper'

# GET /api/v1/krews/:id/members — the "who's in it" faces on the detail page.
RSpec.describe 'API V1 Krews members' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:krew) do
    Krew.create!(slug: 'testers', name: 'Testers', access: 'open',
                 seeded_by: user.account, last_activity_at: Time.current)
  end

  before do
    krew.krew_memberships.create!(account: user.account, role: 'seeder', source: 'direct')
  end

  it 'returns the accounts in the krew' do
    get "/api/v1/krews/#{krew.slug}/members", headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to contain_exactly(
      include(id: user.account.id.to_s)
    )
  end
end
