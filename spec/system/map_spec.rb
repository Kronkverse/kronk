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
    click_on 'Edit location'

    expect(page).to have_css('.place-control')
    expect(page).to have_field(placeholder: /What are you up to/, with: 'Home for spring')
  end

  it 'keeps the menu as the one way in: your own pin card has no second button' do
    visit '/hub/map'

    find('.map-people__person--self').click

    expect(page).to have_css('.map-pin-card')
    expect(page).to have_no_css('.map-pin-card__move')
  end

  it 'logs a trek on the day it happened, not the day it was posted' do
    visit '/hub/map/composer'

    fill_in 'Title', with: 'Coast walk'
    fill_in 'Distance (km)', with: '8'
    fill_in 'When it happened', with: '2026-06-01'
    click_on 'Post it'

    expect(page).to have_css('.status-trek-card', text: 'Coast walk')
    expect(page).to have_css('.status-trek-card__when', text: /Jun/)
    expect(Trek.last.recorded_at.to_date).to eq Date.new(2026, 6, 1)
  end
end
