# frozen_string_literal: true

require 'rails_helper'

# What a listing offers (docs/spaces/wachuneed.md, What are you offering?):
# an appointment that comes in lengths books each for its own time, and
# says where it happens.
RSpec.describe 'Wachuneed offerings' do
  let(:buyer_user)  { Fabricate(:user) }
  let(:seller_user) { Fabricate(:user) }
  let(:buyer)       { buyer_user.account }
  let(:seller)      { seller_user.account }
  let(:scopes)      { 'read write read:statuses write:statuses' }

  # A Monday, midnight UTC.
  let(:monday) { Time.utc(2026, 11, 2) }

  let(:consult) do
    Listing.create!(account: seller, title: 'Consultation', category: 'service', state: 'live', offering: 'appointment',
                    variants: { axes: [{ name: 'Length', values: ['1 hour', '30 min follow-up'] }],
                                items: [{ values: ['1 hour'], price_cents: 12_000 }, { values: ['30 min follow-up'], price_cents: 7000 }] },
                    booking: { template: 'appointment', parts: %w(time), time_zone: 'UTC', where: 'online',
                               lengths: { '1 hour' => 60, '30 min follow-up' => 30 },
                               hours: [{ day: 1, from: '09:00', to: '10:00' }] })
  end

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

  it 'keeps what it offers, where, and how long each length books' do
    get "/api/v1/wachuneed/listings/#{consult.id}", headers: headers_for(buyer_user)

    expect(response.parsed_body['offering']).to eq 'appointment'
    expect(response.parsed_body['booking']).to include('where' => 'online', 'lengths' => { '1 hour' => 60, '30 min follow-up' => 30 })
  end

  it 'offers free times by the length chosen' do
    get "/api/v1/wachuneed/listings/#{consult.id}/times", headers: headers_for(buyer_user), params: { variant: ['30 min follow-up'] }
    expect(response.parsed_body['times'].first(2)).to eq %w(2026-11-02T09:00:00Z 2026-11-02T09:30:00Z)

    get "/api/v1/wachuneed/listings/#{consult.id}/times", headers: headers_for(buyer_user), params: { variant: ['1 hour'] }
    expect(response.parsed_body['times'].first).to eq '2026-11-02T09:00:00Z'
    expect(response.parsed_body['times']).to_not include('2026-11-02T09:30:00Z')
  end

  it 'books the chosen length for its own time and price' do
    post "/api/v1/wachuneed/listings/#{consult.id}/requests", headers: headers_for(buyer_user),
                                                              params: { variant: ['30 min follow-up'], starts_at: '2026-11-02T09:30:00Z' }, as: :json

    expect(response).to have_http_status(200)
    offer = consult.listing_offers.last
    expect(offer.ends_at).to eq Time.utc(2026, 11, 2, 10, 0)
    expect(offer.total_cents).to eq 7000
  end

  it 'refuses an offering it does not know' do
    post '/api/v1/wachuneed/listings', headers: headers_for(seller_user),
                                       params: { title: 'Odd', category: 'service', offering: 'spaceship' }, as: :json

    expect(response).to have_http_status(422)
  end
end
