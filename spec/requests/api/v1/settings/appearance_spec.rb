# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Appearance' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/appearance' do
    let(:scopes) { 'read:accounts' }

    it 'exposes time_zone + emoji_style alongside the other appearance fields' do
      user.update!(time_zone: 'Europe/Berlin')
      user.settings['emoji_style'] = 'twemoji'
      user.save!

      get '/api/v1/settings/appearance', headers: headers

      expect(response).to have_http_status(200)
      body = response.parsed_body
      names = body['settings_schema'].pluck('name')
      expect(names).to include('theme', 'interface_language', 'time_zone', 'emoji_style')

      expect(body['values']['time_zone']).to eq('Europe/Berlin')
      expect(body['values']['emoji_style']).to eq('twemoji')
    end
  end

  describe 'PUT /api/v1/settings/appearance' do
    let(:scopes) { 'write:accounts' }

    it 'writes time_zone to the user column' do
      put '/api/v1/settings/appearance', headers: headers, params: { time_zone: 'Asia/Tokyo' }

      expect(response).to have_http_status(200)
      expect(user.reload.time_zone).to eq('Asia/Tokyo')
    end

    it 'writes emoji_style to the settings hash' do
      put '/api/v1/settings/appearance', headers: headers, params: { emoji_style: 'native' }

      expect(response).to have_http_status(200)
      expect(user.reload.settings['emoji_style']).to eq('native')
    end

    it 'rejects an unknown time_zone with 422' do
      put '/api/v1/settings/appearance', headers: headers, params: { time_zone: 'Middle_Earth/Rivendell' }

      expect(response).to have_http_status(422)
    end

    it 'rejects an unknown emoji_style with 422' do
      put '/api/v1/settings/appearance', headers: headers, params: { emoji_style: 'wingding' }

      expect(response).to have_http_status(422)
    end
  end
end
