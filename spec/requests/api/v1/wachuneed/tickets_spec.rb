# frozen_string_literal: true

require 'rails_helper'

# Tickets (docs/spaces/wachuneed.md, Tickets): a listing's dates each get
# a Kalendar event; a ticket request names its date; accepting takes
# seats, and a full date can't be asked for; sold elsewhere, it links out.
RSpec.describe 'Wachuneed tickets' do
  let(:buyer_user)  { Fabricate(:user) }
  let(:seller_user) { Fabricate(:user) }
  let(:buyer)       { buyer_user.account }
  let(:seller)      { seller_user.account }
  let(:scopes)      { 'read write read:statuses write:statuses' }
  let(:start)       { 10.days.from_now.change(hour: 10) }

  before do
    buyer.follow!(seller)
    seller.follow!(buyer)
    allow(Kronk::KornerEvents).to receive(:publish)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes)
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def create_retreat(**extra)
    post '/api/v1/wachuneed/listings', headers: headers_for(seller_user), as: :json,
                                       params: { title: 'Winter retreat', category: 'service', offering: 'tickets', state: 'live',
                                                 ticket_dates: [{ starts_at: start.iso8601, ends_at: (start + 2.days).iso8601,
                                                                  place: 'Basket Range Hall', seats: 2 }],
                                                 **extra }
    Listing.find(response.parsed_body['id'])
  end

  def ask(listing, quantity: 1)
    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user), as: :json,
                                                              params: { ticket_date_id: listing.ticket_dates.first.id, quantity: quantity }
  end

  it 'makes a Kalendar event for each date, Konnected to the listing', :aggregate_failures do
    listing = create_retreat
    date = listing.ticket_dates.first

    expect(date.event).to have_attributes(title: 'Winter retreat', location_name: 'Basket Range Hall', account_id: seller.id)
    expect(date.event.visible_to?(buyer)).to be true
    expect(KornerAttachment.exists?(source_slug: 'wachuneed', source_id: listing.id, target_slug: 'kalendar', target_id: date.event_id)).to be true

    get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(buyer_user)
    expect(response.parsed_body['ticket_dates'].first).to include('place' => 'Basket Range Hall', 'seats' => 2, 'seats_left' => 2)
  end

  it 'takes seats on accept, and refuses more than are left', :aggregate_failures do
    listing = create_retreat
    ask(listing, quantity: 2)
    expect(response).to have_http_status(200)
    offer = listing.listing_offers.last
    expect(offer.starts_at).to eq listing.ticket_dates.first.starts_at

    offer.accept!
    expect(listing.ticket_dates.first.seats_left).to eq 0

    ask(listing)
    expect(response).to have_http_status(422)
    expect(response.parsed_body['error']).to eq 'Not enough seats left'
  end

  it 'refuses a request with no date' do
    listing = create_retreat
    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user), as: :json, params: { quantity: 1 }

    expect(response.parsed_body['error']).to eq 'Choose a date'
  end

  it 'links out instead when sold elsewhere', :aggregate_failures do
    listing = create_retreat(ticket_url: 'https://tickets.example/retreat')

    expect(listing.ticket_dates.first.seats).to be_nil
    ask(listing)
    expect(response.parsed_body['error']).to eq 'Tickets for this are sold elsewhere'
  end

  it 'keeps a date that has accepted tickets' do
    listing = create_retreat
    ask(listing)
    listing.listing_offers.last.accept!

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(seller_user), as: :json, params: { ticket_dates: [] }

    expect(response).to have_http_status(422)
  end
end
