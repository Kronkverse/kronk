# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Statuses Cleanup' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/statuses_cleanup' do
    let(:scopes) { 'read:accounts' }

    it 'returns defaults for an account that has never opened the page' do
      get '/api/v1/settings/statuses_cleanup', headers: headers

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body['enabled']).to be false
      expect(body['min_status_age_options']).to eq(AccountStatusesCleanupPolicy::ALLOWED_MIN_STATUS_AGE)
      expect(body).to include(
        'keep_direct', 'keep_pinned', 'keep_polls', 'keep_media',
        'keep_self_fav', 'keep_self_bookmark', 'min_favs', 'min_reblogs'
      )
    end

    it 'reflects the persisted policy when one exists' do
      user.account.create_statuses_cleanup_policy!(
        enabled: true,
        min_status_age: 1.month.seconds,
        keep_pinned: false,
        min_favs: 5
      )

      get '/api/v1/settings/statuses_cleanup', headers: headers

      body = response.parsed_body
      expect(body['enabled']).to be true
      expect(body['min_status_age']).to eq(1.month.seconds)
      expect(body['keep_pinned']).to be false
      expect(body['min_favs']).to eq(5)
    end
  end

  describe 'PUT /api/v1/settings/statuses_cleanup' do
    let(:scopes) { 'write:accounts' }

    it 'creates the policy on first write' do
      expect(user.account.statuses_cleanup_policy).to be_nil

      put '/api/v1/settings/statuses_cleanup',
          headers: headers,
          params: { enabled: true, min_status_age: 2.weeks.seconds }

      expect(response).to have_http_status(200)
      policy = user.account.reload.statuses_cleanup_policy
      expect(policy).to be_present
      expect(policy.enabled).to be true
      expect(policy.min_status_age).to eq(2.weeks.seconds)
    end

    it 'accepts a blank min_favs as "no minimum" (nil)' do
      user.account.create_statuses_cleanup_policy!(enabled: true, min_favs: 3)

      put '/api/v1/settings/statuses_cleanup', headers: headers, params: { min_favs: '' }

      expect(response).to have_http_status(200)
      expect(user.account.reload.statuses_cleanup_policy.min_favs).to be_nil
    end

    it 'rejects a min_status_age outside the allowed windows with 422' do
      put '/api/v1/settings/statuses_cleanup',
          headers: headers,
          params: { min_status_age: 3600 } # 1 hour, not in the whitelist

      expect(response).to have_http_status(422)
    end
  end
end
