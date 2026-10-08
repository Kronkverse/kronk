# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Wachuneed listings API' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:listing) { Listing.create!(account: user.account, title: 'Bike', description: 'Red', category: 'goods', state: 'live', price_cents: 5000, price_currency: 'AUD') }

  describe 'GET /api/v1/wachuneed/listings/:id' do
    it 'includes the poster and the raw price for the detail page' do
      get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('price_cents' => 5000, 'price_currency' => 'AUD')
      expect(response.parsed_body.dig('account', 'id')).to eq user.account_id.to_s
    end

    it 'keeps the browse grid lean' do
      listing
      get '/api/v1/wachuneed/listings', headers: headers

      expect(response.parsed_body.first).to_not include('account', 'price_cents')
    end
  end

  describe 'PATCH /api/v1/wachuneed/listings/:id' do
    it 'lets the owner edit their listing' do
      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, params: { title: 'Blue bike', description: 'Resprayed', price_cents: 4000 }

      expect(response).to have_http_status(200)
      expect(listing.reload).to have_attributes(title: 'Blue bike', description: 'Resprayed', price_cents: 4000)
    end

    it 'keeps the feed card text in step with the title' do
      Wachuneed::PublishListing.new(listing).call

      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, params: { title: 'Blue bike' }

      expect(listing.reload.status.text).to eq 'Blue bike'
    end

    it 'rejects an invalid edit with the same rules as create' do
      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, params: { category: 'weapons' }

      expect(response).to have_http_status(422)
      expect(listing.reload.category).to eq 'goods'
    end

    it 'refuses anyone but the owner' do
      stranger = Listing.create!(account: Fabricate(:account), title: 'Not yours', category: 'goods', state: 'live')

      patch "/api/v1/wachuneed/listings/#{stranger.id}", headers: headers, params: { title: 'Mine now' }

      expect(response).to have_http_status(403)
      expect(stranger.reload.title).to eq 'Not yours'
    end
  end
end
