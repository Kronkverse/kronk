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

  it 'moves your pin from your own face at the end of the Mates list' do
    visit '/hub/map'

    expect(page).to have_css('.map-people__scroller > :last-child.map-people__self')
    click_on 'Move my pin'

    expect(page).to have_css('.place-control')
    expect(page).to have_field(placeholder: /What are you up to/, with: 'Home for spring')
  end

  it 'keeps the Mates list as the one way in: no Ж moon, no second button on your card' do
    visit '/hub/map'

    find('.kronk-menu__trigger').click
    expect(page).to have_no_button('Edit location')
    find('.kronk-menu__trigger').click

    find('.map-people__person--self').click

    expect(page).to have_css('.map-pin-card')
    expect(page).to have_no_css('.map-pin-card__move')
  end

  it 'asks a Mate to update their pin, once' do
    ana = Fabricate(:account, username: 'ana', display_name: 'Ana')
    bob.account.follow!(ana)
    ana.follow!(bob.account)
    PresenceState.place!(ana, raw_lat: 48.85, raw_lng: 2.35, precision: 'city', scope: 'friends', label: 'Paris')

    visit '/hub/map'
    find('.map-people__person', text: '@ana').click

    within('.map-pin-card') do
      click_on 'Out of date? Ask for an update'
      expect(page).to have_button('Asked for an update this week', disabled: true)
    end

    expect(Nudges::Event.where(recipient_account: ana, verb: 'challenged').count).to eq(1)
  end

  it 'opens the place search straight from the notification link' do
    visit '/hub/map?place=1'

    expect(page).to have_css('.place-control')
  end

  it 'logs a trek on the day it happened, not the day it was posted' do
    visit '/hub/map/composer'

    fill_in 'Morning run', with: 'Coast walk'
    fill_in 'Distance (km)', with: '8'
    fill_in 'When it happened', with: '2026-06-01'
    click_on 'Post it'

    expect(page).to have_css('.status-trek-card', text: 'Coast walk')
    expect(page).to have_css('.status-trek-card__when', text: /Jun/)
    expect(Trek.last.recorded_at.to_date).to eq Date.new(2026, 6, 1)
  end
end
