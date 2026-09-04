# frozen_string_literal: true

require 'rails_helper'

# GET /api/v1/krews/:id/statuses — the mini-feed on the Krew detail page
# (features/krew/krew_detail.tsx). Route accepts both numeric id and slug
# (mirrors the parent KrewsController); the SPA uses the slug.
RSpec.describe 'API V1 Krews statuses' do
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

  # Regression: the nested statuses controller only accepted numeric ids,
  # so the mini-feed 404'd for any URL that used the krew slug (which is
  # the SPA's routing shape). Frontend caught the error silently, leaving
  # the feed permanently empty (2026-09-04).
  it 'resolves the krew by slug' do
    status = Fabricate(:status, account: user.account)
    krew.statuses << status

    get "/api/v1/krews/#{krew.slug}/statuses", headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to contain_exactly(include(id: status.id.to_s))
  end

  it 'still resolves the krew by numeric id' do
    status = Fabricate(:status, account: user.account)
    krew.statuses << status

    get "/api/v1/krews/#{krew.id}/statuses", headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to contain_exactly(include(id: status.id.to_s))
  end
end
