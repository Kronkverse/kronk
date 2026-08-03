# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Notifications' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/notifications' do
    let(:scopes) { 'read:accounts' }

    it 'exposes always_send_emails alongside the email prefs' do
      get '/api/v1/settings/notifications', headers: headers

      expect(response).to have_http_status(200)
      names = response.parsed_body['settings_schema'].pluck('name')
      expect(names).to include('always_send_emails', 'email_mention', 'email_software_updates')
      expect(response.parsed_body['values']).to have_key('always_send_emails')
    end
  end

  describe 'PUT /api/v1/settings/notifications' do
    let(:scopes) { 'write:accounts' }

    it 'persists always_send_emails to the top-level user setting' do
      expect(user.settings['always_send_emails']).to be_falsey

      put '/api/v1/settings/notifications', headers: headers, params: { always_send_emails: true }

      expect(response).to have_http_status(200)
      expect(user.reload.settings['always_send_emails']).to be_truthy
      expect(response.parsed_body['values']['always_send_emails']).to be_truthy
    end
  end
end
