# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Walkthrough' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/walkthrough' do
    let(:scopes) { 'read:accounts' }

    it 'defaults to dismissed: false for a fresh account' do
      get '/api/v1/settings/walkthrough', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to eq('dismissed' => false)
    end

    it 'reflects a previously-dismissed flag' do
      user.settings['web.walkthrough_dismissed'] = true
      user.save!

      get '/api/v1/settings/walkthrough', headers: headers

      expect(response.parsed_body).to eq('dismissed' => true)
    end
  end

  describe 'PUT /api/v1/settings/walkthrough' do
    let(:scopes) { 'write:accounts' }

    it 'persists dismissed: true across requests' do
      expect(user.settings['web.walkthrough_dismissed']).to be_falsey

      put '/api/v1/settings/walkthrough', headers: headers, params: { dismissed: true }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to eq('dismissed' => true)
      expect(user.reload.settings['web.walkthrough_dismissed']).to be_truthy
    end

    it 'accepts dismissed: false to re-arm the tour (restart flow)' do
      user.settings['web.walkthrough_dismissed'] = true
      user.save!

      put '/api/v1/settings/walkthrough', headers: headers, params: { dismissed: false }

      expect(response.parsed_body).to eq('dismissed' => false)
      expect(user.reload.settings['web.walkthrough_dismissed']).to be_falsey
    end
  end
end
