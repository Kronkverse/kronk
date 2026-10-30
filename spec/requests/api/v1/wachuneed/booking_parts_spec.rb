# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/wachuneed.md, Booking (Kommons "Goods & Services").
RSpec.describe 'Wachuneed booking parts' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:next_week) { 1.week.from_now.utc.change(hour: 9).iso8601 }

  def create_listing(**params)
    post '/api/v1/wachuneed/listings', headers: headers, as: :json,
                                       params: { title: 'Naturopathy session', category: 'service', state: 'live', price_cents: 9000, price_currency: 'AUD' }.merge(params)
    expect(response).to have_http_status(200)
    Listing.find(response.parsed_body['id'])
  end

  it 'keeps an appointment: a set length, weekly hours and posted times, in the seller\'s time zone' do
    listing = create_listing(booking: {
      template: 'appointment', parts: %w(time), minutes: 60, time_zone: 'Australia/Melbourne',
      hours: [{ day: 2, from: '09:00', to: '17:00' }, { day: 1, from: '10:00', to: '12:00' }],
      slots: [next_week]
    })

    get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers

    expect(response.parsed_body['booking']).to eq(
      'parts' => %w(time), 'template' => 'appointment', 'minutes' => 60, 'time_zone' => 'Australia/Melbourne',
      'hours' => [{ 'day' => 1, 'from' => '10:00', 'to' => '12:00' }, { 'day' => 2, 'from' => '09:00', 'to' => '17:00' }],
      'slots' => [next_week]
    )
  end

  it 'keeps a job: a time the person suggests, a from and a to, and what to ask them' do
    listing = create_listing(booking: { template: 'job', parts: %w(details route time), ask: 'What needs moving?' })

    expect(listing.booking).to eq(
      'parts' => %w(time route details), 'template' => 'job', 'ask' => 'What needs moving?',
      'hours' => [], 'slots' => [], 'time_zone' => 'UTC'
    )
    expect(listing).to be_bookable
  end

  it 'drops what does not fit: unknown parts, settings of parts left out, bad hours and past times' do
    listing = create_listing(booking: {
      parts: %w(route teleport), ask: 'Not asked', minutes: 60,
      hours: [{ day: 9, from: '09:00', to: '17:00' }],
      slots: [1.day.ago.iso8601, 'soon']
    })

    expect(listing.booking).to eq('parts' => %w(route))

    listing.update!(booking: { parts: %w(time), minutes: 0, hours: [{ day: 1, from: '17:00', to: '09:00' }], slots: [1.day.ago.iso8601, 'soon'] })
    expect(listing.reload.booking).to eq('parts' => %w(time), 'hours' => [], 'slots' => [], 'time_zone' => 'UTC')
  end

  it 'is not booked at all with no parts, and an edit can turn booking off' do
    listing = create_listing(booking: { parts: %w(time) })
    expect(listing).to be_bookable

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json, params: { booking: {} }

    expect(response).to have_http_status(200)
    expect(response.parsed_body['booking']).to eq({})
    expect(listing.reload).to_not be_bookable
  end

  it 'leaves the booking alone on an edit that does not send it' do
    listing = create_listing(booking: { parts: %w(details) })

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json, params: { title: 'Herbal consult' }

    expect(listing.reload.booking).to eq('parts' => %w(details))
  end

  it 'is never on a wanted ad' do
    listing = create_listing(kind: 'wanted', booking: { parts: %w(time) })

    expect(listing.booking).to eq({})
  end
end
