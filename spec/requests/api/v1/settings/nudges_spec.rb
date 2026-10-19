# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Nudges' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/nudges' do
    let(:scopes) { 'read:accounts' }

    it 'lists the delivered nudge types with their mute state' do
      get '/api/v1/settings/nudges', headers: headers

      expect(response).to have_http_status(200)
      body = response.parsed_body

      keys = body['types'].pluck('key')
      expect(keys).to include('feed.frothed', 'feed.replied', 'mates.mate_requested', 'kommons.backed', 'kalendar.rsvpd_{status}')
      expect(keys).to_not include('favourite', 'reblog', 'follow')

      expect(body['types']).to all(include('key', 'korner', 'korner_name', 'label', 'muted'))
      expect(body['types'].none? { |r| r['muted'] }).to be true
      expect(body['muted_types']).to eq([])
    end

    it 'reflects the account\'s mute list, reading old keys as their new rows' do
      user.settings['nudges.muted_types'] = ['favourite', 'kommons.backed', 'reblog']
      user.save!

      get '/api/v1/settings/nudges', headers: headers

      body = response.parsed_body
      expect(body['muted_types']).to contain_exactly('feed.frothed', 'kommons.backed')
      expect(body['types'].select { |r| r['muted'] }.pluck('key')).to contain_exactly('feed.frothed', 'kommons.backed')
    end
  end

  describe 'PUT /api/v1/settings/nudges' do
    let(:scopes) { 'write:accounts' }

    it 'writes the mute list and drops unknown keys' do
      put '/api/v1/settings/nudges',
          headers: headers,
          params: { muted_types: ['feed.frothed', 'kalendar.rsvpd_{status}', 'not_a_real_key'] }

      expect(response).to have_http_status(200)
      expect(user.reload.settings['nudges.muted_types']).to contain_exactly('feed.frothed', 'kalendar.rsvpd_{status}')
    end

    it 'accepts an empty list (unmute everything)' do
      user.settings['nudges.muted_types'] = ['feed.frothed']
      user.save!

      put '/api/v1/settings/nudges', headers: headers, params: { muted_types: [] }

      expect(response).to have_http_status(200)
      expect(user.reload.settings['nudges.muted_types']).to eq([])
    end

    it 'stops a muted type being delivered, and lets an unmuted one through' do
      put '/api/v1/settings/nudges', headers: headers, params: { muted_types: ['kommons.backed'] }

      actor = Fabricate(:account)
      Fabricate(:follow, account: actor, target_account: user.account)
      Fabricate(:follow, account: user.account, target_account: actor)

      args = { actor: actor, recipient: user.account.reload, source_korner_slug: 'kommons', source_type: 'Proposal', source_id: 1 }
      expect(Nudges::EventRouter.deliver(**args, verb: 'backed')).to eq(:muted_dropped)
      expect(Nudges::EventRouter.deliver(**args, verb: 'commented')).to be_a(Nudges::Event)
    end
  end
end
