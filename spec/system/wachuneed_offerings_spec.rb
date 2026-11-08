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
end
