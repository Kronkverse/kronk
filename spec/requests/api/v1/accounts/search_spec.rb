# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Accounts Search API' do
  let(:user)     { Fabricate(:user) }
  let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:scopes)   { 'read:accounts' }
  let(:headers)  { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/accounts/search' do
    it 'returns http success' do
      get '/api/v1/accounts/search', params: { q: 'query' }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.content_type)
        .to start_with('application/json')
    end

    it 'finds only Kronk members, not accounts from other servers' do
      member = Fabricate(:account, username: 'kestrel')
      Fabricate(:account, username: 'kestrel', domain: 'elsewhere.example')

      get '/api/v1/accounts/search', params: { q: 'kestrel' }, headers: headers

      expect(response.parsed_body.pluck(:id)).to eq [member.id.to_s]
    end
  end
end
