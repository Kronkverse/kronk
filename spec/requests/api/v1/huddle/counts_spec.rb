# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Huddle count' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/huddle/count' do
    it 'gives the count the server last saw' do
      Kronk::HuddleCount.remember(3)

      get '/api/v1/huddle/count', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to eq('participants' => 3)
    end

    it 'reads nothing seen lately as nobody there, without asking Jitsi' do
      redis.del(Kronk::HuddleCount::LAST_SEEN_KEY)

      get '/api/v1/huddle/count', headers: headers

      expect(response.parsed_body).to eq('participants' => 0)
    end

    it 'needs a signed-in user' do
      get '/api/v1/huddle/count'

      expect(response).to have_http_status(401)
    end
  end
end
