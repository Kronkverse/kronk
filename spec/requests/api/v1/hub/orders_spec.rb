# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Hub grid order' do
  let(:user)    { Fabricate(:user) }
  let(:scopes)  { 'read:accounts write:accounts' }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  before { Kronk::KornerRegistry.reload! }

  describe 'GET /api/v1/hub/order' do
    it 'returns an empty order for a fresh account' do
      get '/api/v1/hub/order', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body['order']).to eq([])
    end

    it 'returns the account’s custom order when set' do
      user.account.user_hub_orders.create!(korner_slug: 'kalendar', position: 0)
      user.account.user_hub_orders.create!(korner_slug: 'kommons', position: 1)

      get '/api/v1/hub/order', headers: headers

      expect(response.parsed_body['order']).to eq(%w(kalendar kommons))
    end
  end

  describe 'PUT /api/v1/hub/order' do
    it 'stores a valid ordering and returns it back' do
      put '/api/v1/hub/order', params: { order: %w(kommons kalendar) }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body['order']).to eq(%w(kommons kalendar))
    end

    it 'rejects unknown slugs with 422' do
      put '/api/v1/hub/order', params: { order: %w(kommons not-a-real-korner) }, headers: headers

      expect(response).to have_http_status(422)
    end

    it 'rejects duplicate slugs' do
      put '/api/v1/hub/order', params: { order: %w(kommons kommons) }, headers: headers

      expect(response).to have_http_status(422)
    end

    it 'wholesale replaces the ordering (no leftover rows)' do
      put '/api/v1/hub/order', params: { order: %w(kommons kalendar booth) }, headers: headers
      put '/api/v1/hub/order', params: { order: %w(booth) }, headers: headers

      expect(response.parsed_body['order']).to eq(%w(booth))
      expect(user.account.user_hub_orders.count).to eq(1)
    end
  end

  describe 'DELETE /api/v1/hub/order' do
    it 'resets the account back to the default order' do
      user.account.user_hub_orders.create!(korner_slug: 'kalendar', position: 0)

      delete '/api/v1/hub/order', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body['order']).to eq([])
      expect(user.account.user_hub_orders.count).to eq(0)
    end
  end
end
