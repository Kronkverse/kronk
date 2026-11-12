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

  # The list's row of faces (Tal, 2026-11-11): the first few people in
  # each Krew, not the suspended, and only on the list.
  it 'lists each krew with its first few faces', :aggregate_failures do
    others = Array.new(6) { Fabricate(:account) }
    others.each { |account| krew.krew_memberships.create!(account: account, role: 'member', source: 'direct') }
    others.first.suspend!

    get '/api/v1/krews', params: { scope: 'mine' }, headers: headers

    faces = response.parsed_body.find { |row| row[:slug] == 'testers' }[:faces]
    expect(faces.size).to eq 5
    expect(faces.first).to include(id: user.account.id.to_s, acct: user.account.acct)
    expect(faces.pluck(:id)).to_not include(others.first.id.to_s)

    get "/api/v1/krews/#{krew.slug}", headers: headers
    expect(response.parsed_body).to_not have_key(:faces)
  end
end
