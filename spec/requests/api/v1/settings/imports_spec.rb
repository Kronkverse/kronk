# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Imports' do
  let(:user)    { Fabricate(:user) }
  let(:account) { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  # Minimal one-line CSV matching Mastodon's Follows export format.
  let(:follows_csv) do
    Rack::Test::UploadedFile.new(
      StringIO.new("Account address,Show boosts,Notify on new posts,Languages\nsomeone@example.com,true,false,en\n"),
      'text/csv',
      original_filename: 'following_accounts.csv'
    )
  end

  describe 'GET /api/v1/settings/imports' do
    let(:scopes) { 'read:accounts' }

    it 'lists recent bulk imports newest-first' do
      old = Fabricate(:bulk_import, account: account, created_at: 2.days.ago, type: :blocking)
      recent = Fabricate(:bulk_import, account: account, created_at: 1.hour.ago, type: :following)

      get '/api/v1/settings/imports', headers: headers

      expect(response).to have_http_status(200)
      ids = response.parsed_body['imports'].pluck('id')
      expect(ids).to eq([recent.id.to_s, old.id.to_s])
    end
  end

  describe 'POST /api/v1/settings/imports' do
    let(:scopes) { 'write:accounts' }

    it 'creates an unconfirmed bulk import + reports preview counts' do
      post '/api/v1/settings/imports',
           headers: headers,
           params: { type: 'following', mode: 'merge', data: follows_csv }

      expect(response).to have_http_status(200)
      body = response.parsed_body['import']
      expect(body['state']).to eq('unconfirmed')
      expect(body['total_items']).to eq(1)
      expect(body['likely_mismatched']).to be false
      expect(account.bulk_imports.reload.count).to eq(1)
    end
  end

  describe 'POST /api/v1/settings/imports/:id/confirm' do
    let(:scopes) { 'write:accounts' }

    it 'transitions unconfirmed → scheduled + queues the worker' do
      bulk_import = Fabricate(:bulk_import, account: account, state: :unconfirmed)
      allow(BulkImportWorker).to receive(:perform_async)

      post "/api/v1/settings/imports/#{bulk_import.id}/confirm", headers: headers

      expect(response).to have_http_status(200)
      expect(bulk_import.reload.state_scheduled?).to be true
      expect(BulkImportWorker).to have_received(:perform_async).with(bulk_import.id)
    end

    it 'refuses to re-confirm a scheduled import' do
      bulk_import = Fabricate(:bulk_import, account: account, state: :scheduled)

      post "/api/v1/settings/imports/#{bulk_import.id}/confirm", headers: headers

      expect(response).to have_http_status(422)
      expect(response.parsed_body['error']).to eq('already_confirmed')
    end
  end

  describe 'DELETE /api/v1/settings/imports/:id' do
    let(:scopes) { 'write:accounts' }

    it 'deletes an unconfirmed import' do
      bulk_import = Fabricate(:bulk_import, account: account, state: :unconfirmed)

      delete "/api/v1/settings/imports/#{bulk_import.id}", headers: headers

      expect(response).to have_http_status(200)
      expect(BulkImport.exists?(bulk_import.id)).to be false
    end

    it 'refuses to delete a scheduled or in-progress import' do
      bulk_import = Fabricate(:bulk_import, account: account, state: :in_progress)

      delete "/api/v1/settings/imports/#{bulk_import.id}", headers: headers

      expect(response).to have_http_status(422)
      expect(BulkImport.exists?(bulk_import.id)).to be true
    end
  end
end
