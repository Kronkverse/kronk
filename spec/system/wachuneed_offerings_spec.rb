# frozen_string_literal: true

require 'rails_helper'

# What are you offering? (docs/spaces/wachuneed.md; Tal, 2026-11-09): adding
# to a shop asks first, and each kind of offer has its own short composer.
RSpec.describe 'Wachuneed offerings', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'adds an appointment to a shop, asking what is offered first', :aggregate_failures do
    ListingShop.create!(account: bob.account, name: 'Bob Wellness')
    visit '/hub/wachuneed/my-shop?item=new'

    within('.compose-shell') do
      expect(page).to have_content('What are you offering?')
      click_on 'Appointment'
    end
    within('.compose-shell') do
      expect(page).to have_css('.compose-shell__label', text: 'Appointment')
      find('input[aria-label="Name"]').fill_in with: 'Naturopathy consultation'
      find('input[aria-label="Price"]').fill_in with: '120'
      click_on 'Add to shop'
    end

    expect(page).to have_no_css('.compose-shell')
    listing = Listing.find_by(title: 'Naturopathy consultation')
    expect(listing).to have_attributes(offering: 'appointment', category: 'service', price_cents: 12_000)
    expect(listing.booking).to include('parts' => ['time'], 'minutes' => 60, 'where' => 'either')
    expect(listing.options.first['name']).to eq 'Where'
  end

  it 'posts a service with packages and quotes from the quick New listing', :aggregate_failures do
    visit '/hub/wachuneed/new'

    within('.compose-shell') { click_on 'Change what you are offering' }
    within('.compose-shell') { click_on 'Service' }
    within('.compose-shell') do
      find('input[aria-label="Name"]').fill_in with: 'Music production'
      find('input[aria-label="Mix and master"]').fill_in with: 'Mixing'
      find('input[aria-label="Price"]').fill_in with: '250'
      click_on 'Post'
    end

    expect(page).to have_current_path(%r{/hub/wachuneed/listings/})
    listing = Listing.find_by(title: 'Music production')
    expect(listing.offering).to eq 'service'
    expect(listing.variants['axes']).to eq [{ 'name' => 'Package', 'values' => ['Mixing', 'Something else'] }]
    expect(listing.booking).to include('parts' => ['details'])
  end

  it 'posts a trip that is quoted and asks for a from and a to' do
    visit '/hub/wachuneed/new?offering=trip'

    within('.compose-shell') do
      find('input[aria-label="Name"]').fill_in with: 'Car delivery'
      click_on 'Post'
    end

    expect(page).to have_current_path(%r{/hub/wachuneed/listings/})
    expect(Listing.find_by(title: 'Car delivery')).to have_attributes(offering: 'trip', price_cents: nil, booking: include('parts' => %w(time route details)))
  end

  it 'adds a retreat with dates and ticket types, each date a Kalendar event', :aggregate_failures do
    ListingShop.create!(account: bob.account, name: 'Bob Retreats')
    visit '/hub/wachuneed/my-shop?item=new'
    within('.compose-shell') { click_on 'Tickets' }
    within('.compose-shell') do
      find('input[aria-label="Name"]').fill_in with: 'Winter retreat'
      find('input[aria-label="Starts"]').fill_in with: 10.days.from_now.strftime('%Y-%m-%dT10:00')
      find('input[aria-label="Where"]').fill_in with: 'Basket Range Hall'
      find('input[aria-label="Full"]').fill_in with: 'Full'
      find('input[aria-label="Price"]').fill_in with: '450'
      click_on 'Add to shop'
    end

    expect(page).to have_no_css('.compose-shell')
    listing = Listing.find_by(title: 'Winter retreat')
    expect(listing).to have_attributes(offering: 'tickets', price_cents: 45_000)
    expect(listing.ticket_dates.first).to have_attributes(place: 'Basket Range Hall', seats: 20)
    expect(listing.ticket_dates.first.event.title).to eq 'Winter retreat'
  end

  it 'asks for tickets on a date' do
    seller = Fabricate(:account, username: 'retreats')
    seller.follow!(bob.account)
    bob.account.follow!(seller)
    listing = Listing.create!(account: seller, title: 'Breathwork day', category: 'service', state: 'live', offering: 'tickets',
                              ongoing: true, price_cents: 9000, price_currency: 'AUD')
    Wachuneed::TicketDates.sync(listing, [{ starts_at: 12.days.from_now.iso8601, place: 'The Hall', seats: 10 }])

    visit "/hub/wachuneed/listings/#{listing.id}"
    expect(page).to have_content('10 seats left')
    find('.wachuneed-ticket-date', text: 'The Hall').click
    click_on 'Ask for tickets'

    expect(page).to have_content('Asked.')
    expect(listing.listing_offers.last.ticket_date).to eq listing.ticket_dates.first
  end
end
