# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Korners' do
  before { Kronk::KornerRegistry.reload! }

  describe 'GET /api/v1/korners' do
    it 'returns http success and an array of korner manifests' do
      get api_v1_korners_path

      expect(response).to have_http_status(200)
      expect(response.content_type).to start_with('application/json')

      body = response.parsed_body
      expect(body).to be_an(Array)
      expect(body).to_not be_empty

      slugs = body.pluck('slug')
      expect(slugs).to include('kommons', 'kalendar', 'booth')
    end

    it 'exposes the manifest structural fields on each korner' do
      get api_v1_korners_path

      kommons = response.parsed_body.find { |k| k['slug'] == 'kommons' }
      expect(kommons).to include(
        'slug' => 'kommons',
        'name' => 'Kommons',
        'enforced' => true
      )
      expect(kommons).to have_key('resources')
      expect(kommons).to have_key('storage')
      expect(kommons).to have_key('feed_projection')
    end
  end

  describe 'GET /api/v1/korners/:slug' do
    it 'returns a single korner manifest' do
      get api_v1_korner_path(id: 'kommons')

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('slug' => 'kommons', 'name' => 'Kommons')
    end

    it 'returns 404 for an unknown slug' do
      get api_v1_korner_path(id: 'does-not-exist')

      expect(response).to have_http_status(404)
    end

    it 'resolves hyphenated slugs' do
      get api_v1_korner_path(id: 'in-flow')

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('slug' => 'in-flow')
    end
  end

  describe 'POST /api/v1/korners/:slug/tune_out' do
    let(:user) { Fabricate(:user) }
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:accounts') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it 'creates a KornerTuneOut row for the current account' do
      expect do
        post tune_out_api_v1_korner_path(id: 'kommons'), headers: headers
      end.to change { KornerTuneOut.where(account: user.account, korner_slug: 'kommons').count }.from(0).to(1)

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('tuned_in' => false, 'slug' => 'kommons')
    end

    it 'is idempotent — a second call is a no-op' do
      user.account.tune_out!('kommons')

      expect do
        post tune_out_api_v1_korner_path(id: 'kommons'), headers: headers
      end.not_to(change { KornerTuneOut.where(account: user.account, korner_slug: 'kommons').count })
    end

    it 'requires authentication' do
      post tune_out_api_v1_korner_path(id: 'kommons')

      expect(response).to have_http_status(401).or have_http_status(403)
    end
  end

  describe 'DELETE /api/v1/korners/:slug/tune_out' do
    let(:user) { Fabricate(:user) }
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:accounts') }
    let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

    it 'removes the row and reports tuned_in true' do
      user.account.tune_out!('kommons')

      delete tune_out_api_v1_korner_path(id: 'kommons'), headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('tuned_in' => true, 'slug' => 'kommons')
      expect(KornerTuneOut.where(account: user.account, korner_slug: 'kommons')).to be_empty
    end
  end
end
