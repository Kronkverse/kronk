# frozen_string_literal: true

require 'rails_helper'

# Booking a listing built from parts (docs/spaces/wachuneed.md, Booking): a
# time from the seller's free times (or one suggested), a from and a to,
# and what they need; the seller accepts or declines as with any request,
# and either can call an accepted booking off.
RSpec.describe 'Wachuneed bookings' do
  let(:buyer_user)  { Fabricate(:user) }
  let(:seller_user) { Fabricate(:user) }
  let(:buyer)       { buyer_user.account }
  let(:seller)      { seller_user.account }
  let(:scopes)      { 'read write read:statuses write:statuses' }

  # A Monday, midnight UTC.
  let(:monday) { Time.utc(2026, 11, 2) }

  let(:appointment) do
    Listing.create!(account: seller, title: 'Naturopathy session', category: 'service', state: 'live', price_cents: 9000, price_currency: 'AUD',
                    booking: { template: 'appointment', parts: %w(time), minutes: 60, time_zone: 'UTC',
                               hours: [{ day: 1, from: '09:00', to: '11:00' }],
                               slots: [(monday + 2.days + 14.hours).iso8601] })
  end

  let(:job) do
    Listing.create!(account: seller, title: 'Moving help', category: 'service', state: 'live',
                    booking: { template: 'job', parts: %w(time route details), ask: 'What needs moving?' })
  end

  let(:route) { { from: { lat: -37.8136, lng: 144.9631, name: 'Home' }, to: { lat: -37.85, lng: 145.0 } } }

  before do
    travel_to monday
    buyer.follow!(seller)
    seller.follow!(buyer)
    allow(Kronk::KornerEvents).to receive(:publish)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes)
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def book(listing, **params)
    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user), params: params, as: :json
  end

  it 'lists the free times: weekly hours cut into hours, and the posted time' do
    get "/api/v1/wachuneed/listings/#{appointment.id}/times", headers: headers_for(buyer_user)

    expect(response.parsed_body['suggest']).to be false
    expect(response.parsed_body['times']).to eq [
      '2026-11-02T09:00:00Z', '2026-11-02T10:00:00Z', '2026-11-04T14:00:00Z',
      '2026-11-09T09:00:00Z', '2026-11-09T10:00:00Z'
    ]
  end

  it 'books a free time, which is then held, and lapses back when declined' do
    book(appointment, starts_at: '2026-11-02T10:00:00Z')

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to include('starts_at' => '2026-11-02T10:00:00.000Z', 'ends_at' => '2026-11-02T11:00:00.000Z')

    get "/api/v1/wachuneed/listings/#{appointment.id}/times", headers: headers_for(buyer_user)
    expect(response.parsed_body['times']).to_not include('2026-11-02T10:00:00Z')

    # The same person may book another time; nobody may book a held one.
    book(appointment, starts_at: '2026-11-02T10:00:00Z')
    expect(response).to have_http_status(422)
    expect(response.parsed_body['error']).to eq 'That time is not free'

    post "/api/v1/wachuneed/requests/#{ListingOffer.last.id}/decline", headers: headers_for(seller_user)
    get "/api/v1/wachuneed/listings/#{appointment.id}/times", headers: headers_for(buyer_user)
    expect(response.parsed_body['times']).to include('2026-11-02T10:00:00Z')
  end

  it 'refuses a time outside the hours, or none' do
    book(appointment, starts_at: '2026-11-02T13:00:00Z')
    expect(response.parsed_body['error']).to eq 'That time is not free'

    book(appointment)
    expect(response.parsed_body['error']).to eq 'Choose a time'
  end

  it 'books a job: a suggested time, a from and a to, and what is needed' do
    get "/api/v1/wachuneed/listings/#{job.id}/times", headers: headers_for(buyer_user)
    expect(response.parsed_body).to eq('suggest' => true, 'times' => [])

    book(job, starts_at: '2026-11-07T08:30:00Z', route: route, details: 'A couch and six boxes')

    expect(response).to have_http_status(200)
    body = response.parsed_body
    expect(body['starts_at']).to eq '2026-11-07T08:30:00.000Z'
    expect(body['ends_at']).to be_nil
    expect(body['route']).to eq('from' => { 'lat' => -37.8136, 'lng' => 144.9631, 'name' => 'Home' }, 'to' => { 'lat' => -37.85, 'lng' => 145.0 })
    expect(body['details']).to eq 'A couch and six boxes'

    # The seller sees it among what was asked of them.
    get '/api/v1/wachuneed/requests', headers: headers_for(seller_user)
    expect(response.parsed_body.first['details']).to eq 'A couch and six boxes'
  end

  it 'asks for every part the listing has' do
    book(job, starts_at: '2026-11-07T08:30:00Z', route: { from: route[:from] })

    expect(response).to have_http_status(422)
    expect(response.parsed_body['error']).to eq 'Give a from and a to and Say what you need'
  end

  it 'leaves a booked listing up when one is accepted, and lets either side call it off' do
    book(appointment, starts_at: '2026-11-02T09:00:00Z')
    booking = ListingOffer.last

    post "/api/v1/wachuneed/requests/#{booking.id}/accept", headers: headers_for(seller_user)
    expect(appointment.reload.state).to eq 'live'

    post "/api/v1/wachuneed/requests/#{booking.id}/cancel", headers: headers_for(buyer_user)

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to include('state' => 'cancelled', 'cancelled_by_seller' => false)
    expect(Kronk::KornerEvents).to have_received(:publish)
      .with('wachuneed.offer.cancelled', hash_including(actor_account_id: buyer.id, recipient_account_id: seller.id))

    get "/api/v1/wachuneed/listings/#{appointment.id}/times", headers: headers_for(buyer_user)
    expect(response.parsed_body['times']).to include('2026-11-02T09:00:00Z')
  end

  it 'calls off only an accepted booking, and only for the two of them' do
    book(appointment, starts_at: '2026-11-02T09:00:00Z')
    booking = ListingOffer.last

    post "/api/v1/wachuneed/requests/#{booking.id}/cancel", headers: headers_for(seller_user)
    expect(response).to have_http_status(422)

    booking.accept!
    post "/api/v1/wachuneed/requests/#{booking.id}/cancel", headers: headers_for(Fabricate(:user))
    expect(response).to have_http_status(404)
  end
end
