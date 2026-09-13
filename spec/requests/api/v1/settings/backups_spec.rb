# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Backups' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/backups' do
    let(:scopes) { 'read:accounts' }

    it 'returns an empty list + can_create_now when no backups exist' do
      get '/api/v1/settings/backups', headers: headers

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body['backups']).to eq([])
      expect(body['can_create_now']).to be true
      expect(body['next_available_at']).to be_nil
    end

    it 'lists existing backups newest-first + reports rate-limit window' do
      old = Fabricate(:backup, user: user, created_at: 10.days.ago)
      recent = Fabricate(:backup, user: user, created_at: 1.day.ago)

      get '/api/v1/settings/backups', headers: headers

      body = response.parsed_body
      ids = body['backups'].pluck('id')
      expect(ids).to eq([recent.id.to_s, old.id.to_s])
      expect(body['can_create_now']).to be false
      expect(body['next_available_at']).to be_present
    end
  end

  describe 'POST /api/v1/settings/backups' do
    let(:scopes) { 'write:accounts' }

    it 'creates a backup + queues the worker' do
      allow(BackupWorker).to receive(:perform_async)

      post '/api/v1/settings/backups', headers: headers

      expect(response).to have_http_status(200)
      expect(user.backups.reload.count).to eq(1)
      expect(BackupWorker).to have_received(:perform_async).with(kind_of(Integer))
    end

    it 'rate-limits when a recent backup exists' do
      Fabricate(:backup, user: user, created_at: 1.day.ago)

      post '/api/v1/settings/backups', headers: headers

      expect(response).to have_http_status(429)
      body = response.parsed_body
      expect(body['error']).to eq('rate_limited')
      expect(body['next_available_at']).to be_present
    end
  end
end
