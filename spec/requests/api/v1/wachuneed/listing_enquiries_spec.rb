# frozen_string_literal: true

require 'rails_helper'

# Who can message the poster about a listing (docs/spaces/wachuneed.md,
# Enquiries): Mates, Orbit or anyone, chosen per listing.
RSpec.describe 'Wachuneed listing enquiries' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:scopes)  { 'read write read:statuses write:statuses' }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:seller)  { Fabricate(:account) }

  def listing(**attrs)
    Listing.create!(account: seller, title: 'Soap', category: 'goods', state: 'live', **attrs)
  end

  def mate!(one, two)
    one.follow!(two)
    two.follow!(one)
  end

  def can_message?(item)
    get "/api/v1/wachuneed/listings/#{item.id}", headers: headers
    response.parsed_body['can_message']
  end

  # Opens the chat from the listing and sends the first message, as
  # "Message the poster" does. Returns the two statuses.
  def enquire(item, body: 'Is it still going?')
    post '/api/v1/nudges/conversations', headers: headers, params: { account_id: seller.id, listing_id: item.id }
    opened = response.status
    return [opened, nil] unless opened == 200

    post "/api/v1/nudges/conversations/#{response.parsed_body['id']}/messages", headers: headers,
                                                                                params: { body: body, listing_id: item.id }
    [opened, response.status]
  end

  describe 'setting it' do
    let(:seller) { me }

    it 'saves the choice on create and edit, and reports what applies' do
      post '/api/v1/wachuneed/listings', headers: headers, params: { title: 'Bike', category: 'goods', state: 'live', enquiries: 'orbit' }
      created = Listing.find(response.parsed_body['id'])
      expect(created.enquiries).to eq 'orbit'

      patch "/api/v1/wachuneed/listings/#{created.id}", headers: headers, params: { enquiries: 'anyone' }
      expect(response.parsed_body['enquiries']).to eq 'anyone'
      expect(created.reload.enquiries).to eq 'anyone'
    end

    it 'refuses a value off the ladder' do
      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, params: { enquiries: 'kronkverse' }

      expect(response).to have_http_status(422)
    end
  end

  context 'when the listing is for Mates (the default)' do
    it 'lets a Mate message the poster' do
      mate!(me, seller)
      item = listing

      expect(can_message?(item)).to be true
      expect(enquire(item)).to eq [200, 201]
    end

    it 'turns away someone in Orbit and a stranger' do
      mid = Fabricate(:account)
      mate!(me, mid)
      mate!(mid, seller)
      item = listing

      expect(can_message?(item)).to be false
      expect(enquire(item).first).to eq 403
    end
  end

  context 'when the listing is for Orbit' do
    it 'lets a Mate of a Mate message the poster' do
      mid = Fabricate(:account)
      mate!(me, mid)
      mate!(mid, seller)
      item = listing(enquiries: 'orbit')

      expect(can_message?(item)).to be true
      expect(enquire(item)).to eq [200, 201]
    end

    it 'turns away a stranger' do
      item = listing(enquiries: 'orbit')

      expect(can_message?(item)).to be false
      expect(enquire(item).first).to eq 403
    end
  end

  context 'when the listing is for anyone' do
    it 'lets a stranger message the poster, and the message carries the listing' do
      item = listing(enquiries: 'anyone')

      expect(can_message?(item)).to be true
      expect(enquire(item)).to eq [200, 201]
      expect(response.parsed_body['body']).to include('Is it still going?', "/hub/wachuneed/listings/#{item.id}")
    end

    it 'does not open general messaging: a chat or message without the listing is refused' do
      item = listing(enquiries: 'anyone')

      post '/api/v1/nudges/conversations', headers: headers, params: { account_id: seller.id }
      expect(response).to have_http_status(403)

      post '/api/v1/nudges/conversations', headers: headers, params: { account_id: seller.id, listing_id: item.id }
      conversation_id = response.parsed_body['id']

      post "/api/v1/nudges/conversations/#{conversation_id}/messages", headers: headers, params: { body: 'Hi' }
      expect(response).to have_http_status(403)
    end

    it 'does not open a chat with someone else on the strength of this listing' do
      item = listing(enquiries: 'anyone')
      someone = Fabricate(:account)

      post '/api/v1/nudges/conversations', headers: headers, params: { account_id: someone.id, listing_id: item.id }
      expect(response).to have_http_status(403)
    end

    it 'closes once the listing is taken down' do
      item = listing(enquiries: 'anyone')
      item.close!

      expect(enquire(item).first).to eq 403
    end

    it 'stays shut to someone the poster has blocked' do
      item = listing(enquiries: 'anyone')
      seller.block!(me)

      expect(can_message?(item)).to be false
      expect(enquire(item).first).to eq 403
    end
  end

  it "follows the shop's setting when the listing has none" do
    ListingShop.create!(account: seller, name: 'Open', enquiries: 'anyone')
    item = listing

    get "/api/v1/wachuneed/listings/#{item.id}", headers: headers
    expect(response.parsed_body).to include('enquiries' => 'anyone', 'can_message' => true)
  end
end
