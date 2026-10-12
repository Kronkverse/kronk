# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/map.md: Presence. Moving a pin you already have.
RSpec.describe 'Map', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    PresenceState.place!(bob.account, raw_lat: -33.87, raw_lng: 151.21, precision: 'city', scope: 'friends', label: 'Sydney', note: 'Home for spring')
  end

  it 'offers the place search from the Ж menu to someone who already has a pin' do
    visit '/hub/map'

    find('.kronk-menu__trigger').click
    click_on 'Update my location'

    expect(page).to have_css('.place-control')
    expect(page).to have_field(placeholder: /What are you up to/, with: 'Home for spring')
  end

  it 'offers it from your own pin card too' do
    visit '/hub/map'

    find('.map-people__person--self').click
    within('.map-pin-card') { click_on 'Change location' }

    expect(page).to have_css('.place-control')
  end
end
