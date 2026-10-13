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

  describe 'photos' do
    def upload
      Fabricate(:media_attachment, account: user.account, status: nil)
    end

    it 'keeps every photo in the order sent, the first as the cover' do
      first, second, third = Array.new(3) { upload }

      post '/api/v1/wachuneed/listings', headers: headers,
                                         params: { title: 'Bike', category: 'goods', state: 'live', media_attachment_ids: [second.id, first.id, third.id] }

      expect(response).to have_http_status(200)
      expect(response.parsed_body['photos'].pluck('id')).to eq([second, first, third].map { |m| m.id.to_s })
      expect(response.parsed_body['photo_url']).to eq response.parsed_body.dig('photos', 0, 'url')
    end

    it 'sends the photos with the feed post' do
      post '/api/v1/wachuneed/listings', headers: headers,
                                         params: { title: 'Bike', category: 'goods', state: 'live', media_attachment_ids: [upload.id, upload.id] }

      status = Listing.last.status
      get "/api/v1/statuses/#{status.id}", headers: headers

      expect(response.parsed_body.dig('listing', 'photos').size).to eq 2
    end

    it 'takes no more than the limit' do
      ids = Array.new(Listing::MAX_PHOTOS + 2) { upload.id }

      post '/api/v1/wachuneed/listings', headers: headers,
                                         params: { title: 'Bike', category: 'goods', state: 'live', media_attachment_ids: ids }

      expect(Listing.last.listing_photos.count).to eq Listing::MAX_PHOTOS
    end

    it 'lets the owner reorder and drop photos on edit' do
      first, second = Array.new(2) { upload }
      ListingPhoto.create!(listing: listing, media_attachment: first, position: 0)
      ListingPhoto.create!(listing: listing, media_attachment: second, position: 1)

      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, params: { media_attachment_ids: [second.id] }

      expect(response.parsed_body['photos'].pluck('id')).to eq [second.id.to_s]
    end

    it 'leaves the photos alone when an edit does not mention them' do
      ListingPhoto.create!(listing: listing, media_attachment: upload, position: 0)

      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, params: { title: 'Blue bike' }

      expect(response.parsed_body['photos'].size).to eq 1
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

  describe 'POST /api/v1/wachuneed/listings/:id/close' do
    it 'takes the listing out of browse and removes its feed post, but keeps it on the owner\'s shelf', :inline_jobs do
      Wachuneed::PublishListing.new(listing).call
      status_id = listing.reload.status_id

      post "/api/v1/wachuneed/listings/#{listing.id}/close", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('state' => 'closed')
      expect(listing.reload).to have_attributes(state: 'closed', status_id: nil)
      expect(listing.closed_at).to be_present
      expect(Status.find_by(id: status_id)).to be_nil

      get '/api/v1/wachuneed/listings', headers: headers
      expect(response.parsed_body.pluck('id')).to_not include(listing.id.to_s)

      get '/api/v1/wachuneed/listings', headers: headers, params: { mine: true }
      expect(response.parsed_body.pluck('id')).to include(listing.id.to_s)
    end

    it 'refuses anyone but the owner' do
      stranger = Listing.create!(account: Fabricate(:account), title: 'Not yours', category: 'goods', state: 'live')

      post "/api/v1/wachuneed/listings/#{stranger.id}/close", headers: headers

      expect(response).to have_http_status(403)
      expect(stranger.reload.state).to eq 'live'
    end
  end

  describe 'offered and wanted listings (Desired)' do
    let!(:offer)  { Listing.create!(account: Fabricate(:account), title: 'Bike for sale', category: 'goods', state: 'live') }
    let!(:wanted) { Listing.create!(account: Fabricate(:account), title: 'Looking for a bike', category: 'goods', state: 'live', kind: 'wanted') }

    it 'treats a listing created without a kind as on offer' do
      expect(offer.reload.kind).to eq 'offer'
    end

    it 'creates a wanted listing' do
      post '/api/v1/wachuneed/listings', headers: headers, params: { title: 'Need a ladder', category: 'goods', state: 'live', kind: 'wanted', price_cents: 3000 }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('kind' => 'wanted', 'title' => 'Need a ladder')
      expect(Listing.find(response.parsed_body['id'])).to be_wanted
    end

    it 'rejects an unknown kind' do
      post '/api/v1/wachuneed/listings', headers: headers, params: { title: 'Odd', category: 'goods', kind: 'auction' }

      expect(response).to have_http_status(422)
    end

    it 'filters the browse list by kind, and returns both without one' do
      get '/api/v1/wachuneed/listings', headers: headers, params: { kind: 'wanted' }
      expect(response.parsed_body.pluck('id')).to eq [wanted.id.to_s]

      get '/api/v1/wachuneed/listings', headers: headers, params: { kind: 'offer' }
      expect(response.parsed_body.pluck('id')).to eq [offer.id.to_s]

      get '/api/v1/wachuneed/listings', headers: headers
      expect(response.parsed_body.pluck('id')).to contain_exactly(offer.id.to_s, wanted.id.to_s)
    end

    it "lists both kinds in the owner's Mine section" do
      mine_wanted = Listing.create!(account: user.account, title: 'Want', category: 'service', state: 'live', kind: 'wanted')
      mine_offer  = Listing.create!(account: user.account, title: 'Have', category: 'service', state: 'draft')

      get '/api/v1/wachuneed/listings', headers: headers, params: { mine: 'true' }

      expect(response.parsed_body.pluck('id')).to contain_exactly(mine_wanted.id.to_s, mine_offer.id.to_s)
    end

    it 'lets the owner switch a listing between offered and wanted' do
      own = Listing.create!(account: user.account, title: 'Bike', category: 'goods', state: 'live')

      patch "/api/v1/wachuneed/listings/#{own.id}", headers: headers, params: { kind: 'wanted' }

      expect(response).to have_http_status(200)
      expect(own.reload.kind).to eq 'wanted'
    end
  end
end
