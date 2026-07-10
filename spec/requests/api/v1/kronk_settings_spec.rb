# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'KronkSettings' do
  let(:user) { Fabricate(:user) }

  describe 'GET /api/v1/kronk_settings' do
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:accounts') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it 'returns the default feed_scope for a fresh user' do
      get api_v1_kronk_settings_path, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('feed_scope' => 'kommunity')
    end

    it 'returns the persisted feed_scope after an update' do
      user.settings.update('kronk.feed_scope' => 'friends')
      user.save!

      get api_v1_kronk_settings_path, headers: headers

      expect(response.parsed_body).to include('feed_scope' => 'friends')
    end
  end

  describe 'PUT /api/v1/kronk_settings' do
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:accounts') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it 'persists a valid feed_scope value' do
      put api_v1_kronk_settings_path, params: { feed_scope: 'friends_of_friends' }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('feed_scope' => 'friends_of_friends')
      expect(user.reload.settings['kronk.feed_scope']).to eq('friends_of_friends')
    end

    it 'rejects a value outside the allowed set' do
      put api_v1_kronk_settings_path, params: { feed_scope: 'planetary' }, headers: headers

      expect(response).to have_http_status(422)
    end

    it 'requires authentication' do
      put api_v1_kronk_settings_path, params: { feed_scope: 'friends' }

      expect(response).to have_http_status(401).or have_http_status(403)
    end
  end
end
