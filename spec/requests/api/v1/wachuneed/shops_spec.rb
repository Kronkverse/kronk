# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/wachuneed.md, Shops.
RSpec.describe 'Wachuneed shops API' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def offer(account, title = 'Soap', **attrs)
    Listing.create!(account: account, title: title, category: 'goods', state: 'live', **attrs)
  end

  describe 'PUT /api/v1/wachuneed/shop' do
    it 'opens a shop with sections in the order given' do
      put '/api/v1/wachuneed/shop', headers: headers,
                                    params: { name: 'Ana Aromas', description: 'Small batch', sections: [{ name: 'Skin Care' }, { name: 'Tinctures' }] }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('name' => 'Ana Aromas', 'enquiries' => 'mates', 'show_on_profile' => false)
      expect(response.parsed_body['sections'].pluck('name')).to eq ['Skin Care', 'Tinctures']
    end

    it 'renames, reorders and removes sections, and a removed one lets go of its listings' do
      shop = ListingShop.create!(account: user.account, name: 'Shop')
      skin = shop.sections.create!(name: 'Skin', position: 0)
      old  = shop.sections.create!(name: 'Old', position: 1)
      soap = offer(user.account, listing_shop_section: old)

      put '/api/v1/wachuneed/shop', headers: headers,
                                    params: { name: 'Shop', sections: [{ name: 'New' }, { id: skin.id, name: 'Skin Care' }] }

      expect(response.parsed_body['sections'].pluck('name')).to eq ['New', 'Skin Care']
      expect(ListingShopSection.exists?(old.id)).to be false
      expect(soap.reload.listing_shop_section_id).to be_nil
    end

    it 'keeps one shop per person' do
      2.times { put '/api/v1/wachuneed/shop', headers: headers, params: { name: 'Shop' } }

      expect(ListingShop.where(account: user.account).count).to eq 1
    end

    it 'needs a name' do
      put '/api/v1/wachuneed/shop', headers: headers, params: { name: ' ' }

      expect(response).to have_http_status(422)
    end
  end

  describe 'GET /api/v1/wachuneed/shops' do
    it "lists stocked shops, your Mates' first, then the oldest" do
      stranger = Fabricate(:account)
      mate     = Fabricate(:account)
      empty    = Fabricate(:account)
      user.account.follow!(mate)
      mate.follow!(user.account)

      ListingShop.create!(account: stranger, name: 'First', created_at: 3.days.ago)
      ListingShop.create!(account: mate, name: 'Mate', created_at: 1.day.ago)
      ListingShop.create!(account: empty, name: 'Empty')
      offer(stranger)
      2.times { offer(mate) }
      offer(empty, 'Want', kind: 'wanted')

      get '/api/v1/wachuneed/shops', headers: headers

      expect(response.parsed_body.pluck('name')).to eq %w(Mate First)
      expect(response.parsed_body.first).to include('listings_count' => 2)
      expect(response.parsed_body.first).to_not include('listings')
    end
  end

  describe 'GET /api/v1/wachuneed/shops/:id' do
    it "returns the shop by username with its sections and the seller's live offers" do
      seller  = Fabricate(:account, username: 'ana')
      shop    = ListingShop.create!(account: seller, name: 'Ana Aromas')
      section = shop.sections.create!(name: 'Skin Care')
      offer(seller, 'Balm', listing_shop_section: section)
      offer(seller, 'Loose')
      offer(seller, 'Sold', state: 'closed')
      offer(seller, 'Wanted', kind: 'wanted')

      get '/api/v1/wachuneed/shops/ana', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body['sections']).to eq [{ 'id' => section.id.to_s, 'name' => 'Skin Care' }]
      expect(response.parsed_body['listings'].to_h { |l| [l['title'], l['shop_section_id']] })
        .to eq('Balm' => section.id.to_s, 'Loose' => nil)
    end

    it 'shows the cover photos of its newest items, and says whether you may message the seller' do
      seller = Fabricate(:account, username: 'ana')
      ListingShop.create!(account: seller, name: 'Ana Aromas')
      balm = offer(seller, 'Balm')
      offer(seller, 'No photo')
      2.times do |position|
        ListingPhoto.create!(listing: balm, media_attachment: Fabricate(:media_attachment, account: seller, status: nil), position: position)
      end

      get '/api/v1/wachuneed/shops/ana', headers: headers

      expect(response.parsed_body['preview_photos']).to eq [balm.listing_photos.first.media_attachment.file.url(:small)]
      expect(response.parsed_body['can_message']).to be false

      ListingShop.find_by(account: seller).update!(enquiries: 'anyone')
      get '/api/v1/wachuneed/shops/ana', headers: headers

      expect(response.parsed_body['can_message']).to be true
    end

    it 'never offers to message your own shop' do
      ListingShop.create!(account: user.account, name: 'Mine', enquiries: 'anyone')

      get "/api/v1/wachuneed/shops/#{user.account.id}", headers: headers

      expect(response.parsed_body['can_message']).to be false
    end

    it 'is not found for someone without a shop' do
      get "/api/v1/wachuneed/shops/#{Fabricate(:account).id}", headers: headers

      expect(response).to have_http_status(404)
    end
  end

  describe 'GET /api/v1/wachuneed/shop' do
    it 'answers null until you open one, then your shop' do
      get '/api/v1/wachuneed/shop', headers: headers
      expect(response).to have_http_status(200)
      expect(response.parsed_body).to be_nil

      ListingShop.create!(account: user.account, name: 'Mine')

      get '/api/v1/wachuneed/shop', headers: headers
      expect(response.parsed_body).to include('name' => 'Mine', 'sections' => [])
    end
  end

  describe 'GET /api/v1/wachuneed/shops/:id/profile' do
    it 'names the shop only when its owner chose to show it on their profile' do
      seller = Fabricate(:account)
      shop   = ListingShop.create!(account: seller, name: 'Quiet')

      get "/api/v1/wachuneed/shops/#{seller.id}/profile", headers: headers
      expect(response.parsed_body).to eq('shop' => nil)

      shop.update!(show_on_profile: true)

      get "/api/v1/wachuneed/shops/#{seller.id}/profile", headers: headers
      expect(response.parsed_body).to eq('shop' => { 'name' => 'Quiet', 'acct' => seller.acct })
    end
  end

  describe 'DELETE /api/v1/wachuneed/shop' do
    it 'closes the shop and leaves the listings' do
      shop    = ListingShop.create!(account: user.account, name: 'Shop')
      listing = offer(user.account, listing_shop_section: shop.sections.create!(name: 'A'))

      delete '/api/v1/wachuneed/shop', headers: headers

      expect(ListingShop.exists?(shop.id)).to be false
      expect(listing.reload).to have_attributes(state: 'live', listing_shop_section_id: nil)
    end
  end

  describe 'placing a listing' do
    it "refuses a section from someone else's shop" do
      theirs = ListingShop.create!(account: Fabricate(:account), name: 'Theirs').sections.create!(name: 'A')

      post '/api/v1/wachuneed/listings', headers: headers,
                                         params: { title: 'Bike', category: 'goods', state: 'live', listing_shop_section_id: theirs.id }

      expect(response).to have_http_status(422)
    end
  end

  describe 'enquiries' do
    let(:seller) { Fabricate(:account) }
    let(:listing) { offer(seller) }

    it 'are Mates only until the seller opens the shop to anyone' do
      get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers
      expect(response.parsed_body).to include('can_message' => false, 'shop' => nil)

      post '/api/v1/nudges/conversations', headers: nudge_headers, params: { account_id: seller.id }
      expect(response).to have_http_status(403)

      ListingShop.create!(account: seller, name: 'Open', enquiries: 'anyone')

      get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers
      expect(response.parsed_body).to include('can_message' => true)
      expect(response.parsed_body['shop']).to eq('name' => 'Open', 'acct' => seller.acct)

      post '/api/v1/nudges/conversations', headers: nudge_headers, params: { account_id: seller.id }
      expect(response).to have_http_status(200)

      post "/api/v1/nudges/conversations/#{response.parsed_body['id']}/messages", headers: nudge_headers, params: { body: 'Is the soap still going?' }
      expect(response).to have_http_status(201)
    end

    def nudge_headers
      scopes = 'read write read:statuses write:statuses'
      { 'Authorization' => "Bearer #{Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes).token}" }
    end
  end
end
