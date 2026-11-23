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

  # `?place=1` is the "update your pin" link; a Map Place has its own
  # `?map_place=<id>`, so Place 1 can't hijack it.
  it 'keeps the pin link and a Place link apart, even for Place 1' do
    place = MapPlace.create!(id: 1, name: 'Bondi Pavilion', address: 'Queen Elizabeth Dr, Bondi Beach', latitude: -33.891, longitude: 151.277, account: bob.account)

    visit '/hub/map?place=1'
    expect(page).to have_css('.place-control')
    expect(page).to have_no_css('.map-place-card')

    visit "/hub/map?map_place=#{place.id}"
    expect(page).to have_css('.map-place-card', text: 'Bondi Pavilion')
  end

  # Tal, 2026-11-23: "Why is there two indicators?" An event at its Place
  # is one marker, and the events sharing a Place are one marker too.
  it 'draws one marker for the events at a Place, and one card', :aggregate_failures do
    hall = MapPlace.create!(account: bob.account, name: 'Moyhu Hall', address: 'Moyhu, Victoria', latitude: -36.58, longitude: 146.38)
    ember = Event.create!(account: bob.account, title: 'Ember', start_time: 3.days.from_now)
    jam = Event.create!(account: bob.account, title: 'Hall jam', start_time: 20.days.from_now)
    [ember, jam].each do |event|
      KornerAttachment.create!(source_slug: 'kalendar', source_id: event.id, target_slug: 'map', target_id: hall.id,
                               kind: 'link', created_by_account: bob.account)
    end

    visit "/hub/map?event=#{ember.slug}"

    within('.map-event-card') do
      expect(page).to have_text('Ember')
      expect(page).to have_text('Hall jam')
      expect(page).to have_text('Moyhu Hall')
      expect(page).to have_link('Open place →', href: "/hub/map/places/#{hall.id}")
    end
    expect(page).to have_css('.map-event-pin', count: 1, text: '+1')
    expect(page).to have_no_css('.map-place-pin')
  end

  # Tal, 2026-11-23: choose what the map shows, under a cog.
  it 'hides and shows layers from the cog, and keeps the choice', :aggregate_failures do
    hall = MapPlace.create!(account: bob.account, name: 'Moyhu Hall', latitude: -36.58, longitude: 146.38)
    ember = Event.create!(account: bob.account, title: 'Ember', start_time: 3.days.from_now)
    KornerAttachment.create!(source_slug: 'kalendar', source_id: ember.id, target_slug: 'map', target_id: hall.id,
                             kind: 'link', created_by_account: bob.account)

    visit "/hub/map?event=#{ember.slug}"
    expect(page).to have_css('.map-event-pin', count: 1)
    expect(page).to have_no_css('.map-place-pin')

    click_on 'What the map shows'
    within('.map-show__menu') { find('label', text: 'Events').click }

    # The event marker goes, and the Place it stood on gets its own pin.
    expect(page).to have_no_css('.map-event-pin')
    expect(page).to have_css('.map-place-pin', count: 1)

    # Kept after a reload (the map opened on the Place).
    visit '/hub/map?lat=-36.58&lng=146.38'
    expect(page).to have_css('.map-place-pin', count: 1)
    expect(page).to have_no_css('.map-event-pin')

    # A link to the event switches Events back on.
    visit "/hub/map?event=#{ember.slug}"
    expect(page).to have_css('.map-event-pin', count: 1)
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
