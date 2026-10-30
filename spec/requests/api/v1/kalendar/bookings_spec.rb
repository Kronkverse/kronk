# frozen_string_literal: true

require 'rails_helper'

# Accepted bookings in both people's Kalendars (docs/spaces/kalendar.md, Me;
# docs/spaces/wachuneed.md, Booking).
RSpec.describe 'Kalendar bookings' do
  let(:buyer_user)  { Fabricate(:user) }
  let(:seller_user) { Fabricate(:user) }
  let(:buyer)       { buyer_user.account }
  let(:seller)      { seller_user.account }
  let(:starts_at)   { 3.days.from_now.utc.change(hour: 9) }

  let(:listing) do
    Listing.create!(account: seller, title: 'Naturopathy session', category: 'service', state: 'live',
                    booking: { parts: %w(time), minutes: 60 })
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def booking_at(time)
    ListingOffer.ask(listing, offerer: buyer, starts_at: time).tap(&:save!)
  end

  before do
    allow(Kronk::KornerEvents).to receive(:publish)
  end

  it 'shows an accepted booking to both of them, each with the other' do
    booking_at(starts_at).accept!

    get '/api/v1/kalendar/bookings', headers: headers_for(buyer_user)
    expect(response.parsed_body).to contain_exactly(
      hash_including('title' => 'Naturopathy session', 'side' => 'buyer', 'starts_at' => starts_at.iso8601,
                     'ends_at' => (starts_at + 1.hour).iso8601, 'with' => hash_including('id' => seller.id.to_s))
    )

    get '/api/v1/kalendar/bookings', headers: headers_for(seller_user)
    expect(response.parsed_body).to contain_exactly(hash_including('side' => 'seller', 'with' => hash_including('id' => buyer.id.to_s)))
  end

  it 'leaves out bookings still waiting, called off, or long past, and other people\'s' do
    booking_at(starts_at)
    booking_at(starts_at + 1.day).tap(&:accept!).cancel!(by: buyer)
    booking_at(starts_at + 2.days).accept!
    ListingOffer.last.update_columns(starts_at: 3.days.ago, ends_at: 3.days.ago + 1.hour)

    get '/api/v1/kalendar/bookings', headers: headers_for(buyer_user)
    expect(response.parsed_body).to eq []

    get '/api/v1/kalendar/bookings', headers: headers_for(Fabricate(:user))
    expect(response.parsed_body).to eq []
  end
end
