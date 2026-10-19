# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/wachuneed.md, The shop builder.
RSpec.describe 'Wachuneed shop builder' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:bottle) do
    {
      axes: [{ name: 'Size', values: %w(500ml 1L) }, { name: 'Colour', values: %w(Red Blue) }],
      items: [
        { values: %w(500ml Red), price_cents: 2500 },
        { values: %w(500ml Blue), price_cents: 2500, availability: 'sold_out' },
        { values: %w(1L Red), price_cents: 3500, availability: 'made_to_order' },
        { values: %w(1L Blue), price_cents: 1000, availability: 'off' },
      ],
    }
  end

  def create_listing(**params)
    post '/api/v1/wachuneed/listings', headers: headers, as: :json,
                                       params: { title: 'Water bottle', category: 'goods', state: 'live' }.merge(params)
    Listing.find(response.parsed_body['id'])
  end

  describe 'variants' do
    it "keeps every combination in the seller's order, with its price and availability" do
      listing = create_listing(variants: bottle, ongoing: true)

      get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers

      expect(response.parsed_body).to include('ongoing' => true, 'availability' => 'available')
      expect(response.parsed_body.dig('variants', 'axes').pluck('name')).to eq %w(Size Colour)
      expect(response.parsed_body.dig('variants', 'items')).to eq [
        { 'values' => %w(500ml Red), 'price_cents' => 2500, 'availability' => 'available' },
        { 'values' => %w(500ml Blue), 'price_cents' => 2500, 'availability' => 'sold_out' },
        { 'values' => %w(1L Red), 'price_cents' => 3500, 'availability' => 'made_to_order' },
        { 'values' => %w(1L Blue), 'price_cents' => 1000, 'availability' => 'off' },
      ]
    end

    it 'prices the listing from the lowest kind on offer, and says From when they differ' do
      listing = create_listing(variants: bottle, price_cents: 99)

      expect(listing.price_cents).to eq 2500

      get '/api/v1/wachuneed/listings', headers: headers
      expect(response.parsed_body.first).to include('price_display' => 'From A$25.00')
      expect(response.parsed_body.first).to_not include('variants')
    end

    it 'fills in a combination nobody priced, and drops an empty choice' do
      listing = create_listing(variants: { axes: [{ name: 'Size', values: ['S', ' ', 'M'] }, { name: ' ', values: ['x'] }], items: [] })

      expect(listing.variants).to eq(
        'axes' => [{ 'name' => 'Size', 'values' => %w(S M) }],
        'items' => [
          { 'values' => %w(S), 'price_cents' => nil, 'availability' => 'available' },
          { 'values' => %w(M), 'price_cents' => nil, 'availability' => 'available' },
        ]
      )
    end

    it 'is replaced by an edit that sends it, and removed by an empty one' do
      listing = create_listing(variants: bottle)

      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json, params: { availability: 'sold_out' }
      expect(listing.reload).to have_attributes(availability: 'sold_out')
      expect(listing.variants['items'].size).to eq 4

      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json, params: { variants: {} }
      expect(listing.reload.variants).to eq({})
    end
  end

  describe 'announcing' do
    it 'posts an ordinary listing to the feed, as before' do
      expect(create_listing.status_id).to be_present
    end

    it 'adds a shop item quietly, and posts it once the seller announces it' do
      listing = create_listing(announced: false)
      expect(listing.status_id).to be_nil

      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json, params: { title: 'Bottle' }
      expect(listing.reload.status_id).to be_nil

      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json, params: { announced: true }
      expect(listing.reload.status_id).to be_present
    end
  end

  describe 'photos' do
    it 'remembers which choice a photo shows' do
      red  = Fabricate(:media_attachment, account: user.account, status: nil)
      blue = Fabricate(:media_attachment, account: user.account, status: nil)

      listing = create_listing(variants: bottle, media_attachment_ids: [red.id, blue.id], photo_variants: { blue.id.to_s => 'Blue' })

      get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers
      expect(response.parsed_body['photos'].pluck('variant_value')).to eq [nil, 'Blue']
    end
  end

  describe 'shop details' do
    it 'are written once on the shop and shown on each of its items' do
      put '/api/v1/wachuneed/shop', headers: headers, as: :json,
                                    params: { name: 'Bob Bottles', payment: 'Cash or bank transfer', handover: 'Pickup in Mullum, or post for $10', based_in: 'Mullumbimby', about: 'Made by hand.' }
      expect(response.parsed_body).to include('based_in' => 'Mullumbimby', 'about' => 'Made by hand.', 'payment' => 'Cash or bank transfer')

      listing = create_listing
      get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers

      expect(response.parsed_body['shop_details']).to eq(
        'payment' => 'Cash or bank transfer', 'handover' => 'Pickup in Mullum, or post for $10', 'based_in' => 'Mullumbimby'
      )
    end
  end

  describe 'putting items in order' do
    it "shows the shop in the seller's order, anything not placed first, and moves only their own" do
      ListingShop.create!(account: user.account, name: 'Suss Leather')
      cuff  = create_listing(title: 'Cuff')
      belt  = create_listing(title: 'Belt')
      other = Listing.create!(account: Fabricate(:account), title: 'Not mine', category: 'goods', state: 'live')

      put '/api/v1/wachuneed/shop/order', headers: headers, as: :json, params: { listing_ids: [cuff.id, other.id, belt.id] }
      expect(response).to have_http_status(204)
      expect([cuff.reload.shop_position, belt.reload.shop_position]).to eq [0, 1]
      expect(other.reload.shop_position).to be_nil

      wallet = create_listing(title: 'Wallet')
      get "/api/v1/wachuneed/shops/#{user.account.username}", headers: headers
      expect(response.parsed_body['listings'].pluck('id')).to eq([wallet, cuff, belt].map { |l| l.id.to_s })
    end
  end
end
