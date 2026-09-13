# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Nudges' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/nudges' do
    let(:scopes) { 'read:accounts' }

    it 'lists person-to-person types + korner-triggered types with mute state' do
      get '/api/v1/settings/nudges', headers: headers

      expect(response).to have_http_status(200)
      body = response.parsed_body

      keys = body['types'].pluck('key')
      expect(keys).to include('mention', 'favourite', 'follow')
      # At least one korner-triggered key follows the `<slug>.<name>` shape.
      expect(keys).to include(match(/\A[a-z_]+\.[a-z_.]+\z/))

      # Every row has a `muted` boolean; freshly-set account has none.
      expect(body['types'].all? { |r| r.key?('muted') && r['muted'] == false }).to be true
      expect(body['muted_types']).to eq([])
    end

    it 'reflects the account\'s current mute list' do
      user.settings['nudges.muted_types'] = ['mention', 'kommons.backed']
      user.save!

      get '/api/v1/settings/nudges', headers: headers

      body = response.parsed_body
      expect(body['muted_types']).to contain_exactly('mention', 'kommons.backed')
      muted_rows = body['types'].select { |r| r['muted'] }
      expect(muted_rows.pluck('key')).to contain_exactly('mention', 'kommons.backed')
    end
  end

  describe 'PUT /api/v1/settings/nudges' do
    let(:scopes) { 'write:accounts' }

    it 'writes the mute list + drops unknown keys' do
      put '/api/v1/settings/nudges',
          headers: headers,
          params: { muted_types: ['mention', 'kommons.backed', 'not_a_real_key'] }

      expect(response).to have_http_status(200)
      user.reload
      expect(user.settings['nudges.muted_types']).to contain_exactly(
        'mention', 'kommons.backed'
      )
    end

    it 'accepts an empty list (unmute everything)' do
      user.settings['nudges.muted_types'] = ['mention']
      user.save!

      put '/api/v1/settings/nudges', headers: headers, params: { muted_types: [] }

      expect(response).to have_http_status(200)
      expect(user.reload.settings['nudges.muted_types']).to eq([])
    end
  end
end
