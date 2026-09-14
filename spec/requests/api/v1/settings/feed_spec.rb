# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Feed' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/feed' do
    let(:scopes) { 'read:accounts' }

    it 'exposes chosen_languages alongside the display schema' do
      user.update!(chosen_languages: %w(en fr))

      get '/api/v1/settings/feed', headers: headers

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body['chosen_languages']['selected']).to contain_exactly('en', 'fr')
      # Options are the full whitelisted SUPPORTED_LOCALES set with
      # native names so the picker can render them without a second call.
      expect(body['chosen_languages']['options']).to be_an(Array)
      expect(body['chosen_languages']['options'].first).to include('value', 'native_name')
      expect(body['chosen_languages']['options'].pluck('value')).to include('en', 'fr', 'de')
    end
  end

  describe 'PUT /api/v1/settings/feed' do
    let(:scopes) { 'write:accounts' }

    it 'writes the picked languages to the User column' do
      put '/api/v1/settings/feed', headers: headers, params: { chosen_languages: %w(en de) }

      expect(response).to have_http_status(200)
      expect(user.reload.chosen_languages).to contain_exactly('en', 'de')
    end

    it 'silently drops unknown language codes rather than 422' do
      put '/api/v1/settings/feed',
          headers: headers,
          params: { chosen_languages: %w(en xx not_a_real_code) }

      expect(response).to have_http_status(200)
      expect(user.reload.chosen_languages).to contain_exactly('en')
    end

    it 'accepts an empty array as "no filter"' do
      user.update!(chosen_languages: %w(en))

      put '/api/v1/settings/feed', headers: headers, params: { chosen_languages: [] }

      expect(response).to have_http_status(200)
      # `normalizes` on User#chosen_languages collapses an empty array
      # to nil, which reads as "no filter" (matching Mastodon's classic
      # behaviour: unset = every language passes).
      expect(user.reload.chosen_languages).to be_nil
    end
  end
end
