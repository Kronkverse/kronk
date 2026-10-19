# frozen_string_literal: true

require 'rails_helper'

# Who can see a listing, and so message the poster about it
# (docs/spaces/wachuneed.md, Who can see it): the reach ladder, chosen per
# listing and per shop.
RSpec.describe 'Wachuneed listing reach' do
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

  def offered_ids
    get '/api/v1/wachuneed/listings', headers: headers, params: { kind: 'offer' }
    response.parsed_body.pluck('id')
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

    it 'saves the reach on create and edit, and moves the feed card with it' do
      post '/api/v1/wachuneed/listings', headers: headers, params: { title: 'Bike', category: 'goods', state: 'live', visibility: 'orbit' }
      created = Listing.find(response.parsed_body['id'])
      expect(created.visibility).to eq 'orbit'
      expect(created.status.visibility).to eq 'orbit'

      patch "/api/v1/wachuneed/listings/#{created.id}", headers: headers, params: { visibility: 'mates' }
      expect(response.parsed_body['visibility']).to eq 'mates'
      expect(created.reload.visibility).to eq 'mates'
      expect(created.status.reload.visibility).to eq 'mates'
    end

    it 'refuses a value off the ladder' do
      patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, params: { visibility: 'kronkverse' }

      expect(response).to have_http_status(422)
    end
  end

  context 'when the listing is for everyone (the default)' do
    it 'shows it to a stranger, who can message the poster, and the message carries the listing' do
      item = listing

      expect(offered_ids).to include(item.id.to_s)
      get "/api/v1/wachuneed/listings/#{item.id}", headers: headers
      expect(response.parsed_body).to include('visibility' => 'public', 'can_message' => true)
      expect(enquire(item)).to eq [200, 201]
      expect(response.parsed_body['body']).to include('Is it still going?', "/hub/wachuneed/listings/#{item.id}")
    end

    it 'does not open general messaging: a chat or message without the listing is refused' do
      item = listing

      post '/api/v1/nudges/conversations', headers: headers, params: { account_id: seller.id }
      expect(response).to have_http_status(403)

      post '/api/v1/nudges/conversations', headers: headers, params: { account_id: seller.id, listing_id: item.id }
      conversation_id = response.parsed_body['id']

      post "/api/v1/nudges/conversations/#{conversation_id}/messages", headers: headers, params: { body: 'Hi' }
      expect(response).to have_http_status(403)
    end

    it 'does not open a chat with someone else on the strength of this listing' do
      item = listing
      someone = Fabricate(:account)

      post '/api/v1/nudges/conversations', headers: headers, params: { account_id: someone.id, listing_id: item.id }
      expect(response).to have_http_status(403)
    end

    it 'closes once the listing is taken down' do
      item = listing
      item.close!

      expect(enquire(item).first).to eq 403
    end

    it 'stays shut to someone the poster has blocked' do
      item = listing
      seller.block!(me)

      get "/api/v1/wachuneed/listings/#{item.id}", headers: headers
      expect(response).to have_http_status(404)
      expect(enquire(item).first).to eq 403
    end
  end

  context 'when the listing is for Mates' do
    it 'shows it to a Mate, who can message the poster' do
      mate!(me, seller)
      item = listing(visibility: 'mates')

      expect(offered_ids).to include(item.id.to_s)
      expect(enquire(item)).to eq [200, 201]
    end

    it 'hides it from someone in Orbit and from a stranger, and refuses their message' do
      mid = Fabricate(:account)
      mate!(me, mid)
      mate!(mid, seller)
      item = listing(visibility: 'mates')

      expect(offered_ids).to_not include(item.id.to_s)
      get "/api/v1/wachuneed/listings/#{item.id}", headers: headers
      expect(response).to have_http_status(404)
      expect(enquire(item).first).to eq 403
    end
  end

  context 'when the listing is for Orbit' do
    it 'shows it to a Mate of a Mate, who can message the poster' do
      mid = Fabricate(:account)
      mate!(me, mid)
      mate!(mid, seller)
      item = listing(visibility: 'orbit')

      expect(offered_ids).to include(item.id.to_s)
      expect(enquire(item)).to eq [200, 201]
    end

    it 'hides it from a stranger' do
      item = listing(visibility: 'orbit')

      expect(offered_ids).to_not include(item.id.to_s)
      expect(enquire(item).first).to eq 403
    end
  end

  it 'keeps a listing for the poster alone off everyone else' do
    mate!(me, seller)
    item = listing(visibility: 'self_only')

    # Hidden from a Mate too; they can still chat as Mates, just not about it.
    expect(offered_ids).to_not include(item.id.to_s)
    get "/api/v1/wachuneed/listings/#{item.id}", headers: headers
    expect(response).to have_http_status(404)
  end

  it "goes by the listing's own reach, not its shop's" do
    ListingShop.create!(account: seller, name: 'Open', visibility: 'public')
    item = listing(visibility: 'mates')

    expect(offered_ids).to_not include(item.id.to_s)
    expect(enquire(item).first).to eq 403
  end
end
