# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Statuses Audience' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:scopes)  { 'read:statuses' }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/statuses/:status_id/audience' do
    context 'when the post is the authors own gated post with added / removed people' do
      let(:status)  { Fabricate(:status, account: user.account, visibility: :mates) }
      let(:added)   { Fabricate(:account, username: 'added') }
      let(:removed) { Fabricate(:account, username: 'removed') }

      before do
        status.granted_accounts << added
        status.excluded_accounts << removed
        get "/api/v1/statuses/#{status.id}/audience", headers: headers
      end

      it 'returns the resolved audience', :aggregate_failures do
        expect(response).to have_http_status(200)
        expect(response.content_type).to start_with('application/json')

        body = response.parsed_body
        expect(body[:visibility]).to eq 'mates'
        expect(body[:added].pluck(:id)).to contain_exactly(added.id.to_s)
        expect(body[:removed].pluck(:id)).to contain_exactly(removed.id.to_s)
      end
    end

    context 'when the post belongs to another account' do
      let(:status) { Fabricate(:status, visibility: :public) }

      before do
        get "/api/v1/statuses/#{status.id}/audience", headers: headers
      end

      it 'is not found (only the author sees who can see it)' do
        expect(response).to have_http_status(404)
      end
    end
  end
end
