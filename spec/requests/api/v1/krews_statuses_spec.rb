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

  # A Krew post keeps its own reach. Members see it through the Krew;
  # anyone else only sees what StatusPolicy would show them anyway.
  describe 'who sees which posts' do
    let(:outsider)       { Fabricate(:user) }
    let(:outsider_token) { Fabricate(:accessible_access_token, resource_owner_id: outsider.id, scopes: 'read') }
    let!(:private_post)  { Fabricate(:status, account: user.account, visibility: :self_only).tap { |s| krew.statuses << s } }
    let!(:public_post)   { Fabricate(:status, account: user.account, visibility: :public).tap { |s| krew.statuses << s } }

    it 'shows a member every post in the Krew' do
      member = Fabricate(:user)
      krew.krew_memberships.create!(account: member.account, source: 'direct')
      member_token = Fabricate(:accessible_access_token, resource_owner_id: member.id, scopes: 'read')

      get "/api/v1/krews/#{krew.slug}/statuses", headers: { 'Authorization' => "Bearer #{member_token.token}" }

      expect(response.parsed_body.pluck(:id)).to contain_exactly(private_post.id.to_s, public_post.id.to_s)
    end

    it 'hides the Krew-only post from someone outside the Krew' do
      get "/api/v1/krews/#{krew.slug}/statuses", headers: { 'Authorization' => "Bearer #{outsider_token.token}" }

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:id)).to contain_exactly(public_post.id.to_s)
    end

    it 'needs a signed-in user' do
      app_token = Fabricate(:accessible_access_token, resource_owner_id: nil, scopes: 'read')

      get "/api/v1/krews/#{krew.slug}/statuses", headers: { 'Authorization' => "Bearer #{app_token.token}" }

      expect(response).to have_http_status(422)
    end
  end

  it 'fills a page for an outsider past posts they cannot see' do
    outsider = Fabricate(:user)
    outsider_token = Fabricate(:accessible_access_token, resource_owner_id: outsider.id, scopes: 'read')
    open_post = Fabricate(:status, account: user.account, visibility: :public)
    krew.statuses << open_post
    3.times { krew.statuses << Fabricate(:status, account: user.account, visibility: :self_only) }

    get "/api/v1/krews/#{krew.slug}/statuses", params: { limit: 2 }, headers: { 'Authorization' => "Bearer #{outsider_token.token}" }

    expect(response.parsed_body.pluck(:id)).to eq [open_post.id.to_s]
  end
end
