# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/feed.md, What the feed shows: Home opens on Kronkverse unless
# the member picks another width in feed settings (Tal, 2026-11-11).
RSpec.describe 'KronkSettings' do
  let(:user) { Fabricate(:user) }

  describe 'GET /api/v1/kronk_settings' do
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:accounts') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it 'opens on Kronkverse for a fresh user' do
      get api_v1_kronk_settings_path, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to eq('feed_opens_on' => 'kommunity')
    end

    it 'opens on Kronkverse whatever width the barrel was last turned to' do
      user.settings.update('kronk.feed_scope' => 'mates')
      user.save!

      get api_v1_kronk_settings_path, headers: headers

      expect(response.parsed_body).to include('feed_opens_on' => 'kommunity')
    end

    it 'returns the width the member chose' do
      user.settings.update('kronk.feed_opens_on' => 'mates')
      user.save!

      get api_v1_kronk_settings_path, headers: headers

      expect(response.parsed_body).to include('feed_opens_on' => 'mates')
    end
  end

  describe 'PUT /api/v1/kronk_settings' do
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:accounts') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it 'saves the width Home opens on' do
      put api_v1_kronk_settings_path, params: { feed_opens_on: 'me' }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('feed_opens_on' => 'me')
      expect(user.reload.settings['kronk.feed_opens_on']).to eq('me')
    end

    it 'rejects a value outside the allowed set' do
      put api_v1_kronk_settings_path, params: { feed_opens_on: 'planetary' }, headers: headers

      expect(response).to have_http_status(422)
    end

    it 'requires authentication' do
      put api_v1_kronk_settings_path, params: { feed_opens_on: 'mates' }

      expect(response).to have_http_status(401).or have_http_status(403)
    end
  end
end
