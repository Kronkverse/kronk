# frozen_string_literal: true

require 'rails_helper'

# decisions.md, 2026-10-23: any creation Konnects to any other. A composer
# holds its Konnections until what it makes exists (hooks/useKonnect.ts),
# shown in the Konnect row <ComposeShell> draws, and Konnects them once the
# create succeeds.
RSpec.describe 'Konnecting from a composer', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:album) { Album.create!(owner: bob.account, title: 'Studio days', visibility: :public) }

  before { as_a_logged_in_user }

  it 'Konnects a new art piece to an album picked in the Konnect row' do
    album
    visit '/hub/art/composer'

    within('.compose-shell') do
      find('.art-composer__title').set('Blue study')
      within('.konnect-row') { click_on 'Konnect' }
    end
    within('.attachment-picker') do
      click_on 'Albutts'
      click_on 'Studio days'
    end

    within('.compose-shell') do
      expect(page).to have_css('.konnect-row .space-tile', text: 'Studio days')
      click_on 'Post piece'
    end

    expect(page).to have_no_css('.compose-shell')
    piece = ArtPiece.find_by!(title: 'Blue study')
    expect(KornerAttachment.where(source_slug: 'art', source_id: piece.id, target_slug: 'albutts', target_id: album.id, kind: 'link')).to exist
  end

  # decisions.md, 2026-10-23, "Location fields become Konnect → Map": no
  # location field; the picker makes a Place without leaving the composer.
  it "makes a new Place from an event's Konnect row, which says where the event is" do
    allow(Kronk::Geocoder).to receive(:search).and_return([{ lat: -37.8136, lng: 144.9799 }])
    visit '/hub/kalendar/composer'

    within('.compose-shell') do
      expect(page).to have_no_field('Address')
      find('input[placeholder="What is happening?"]').set('Picnic')
      within('.konnect-row') { click_on 'Konnect' }
    end
    new_place_in_picker('Fitzroy Gardens', 'Wellington Pde, East Melbourne')
    within('.compose-shell') do
      expect(page).to have_css('.konnect-row .space-tile', text: 'Fitzroy Gardens')
      click_on 'Post it'
    end

    expect(page).to have_css('.event-detail__location', text: 'Fitzroy Gardens')
    expect(page).to have_css('.konnected-card--map', text: 'Fitzroy Gardens')
    place = MapPlace.find_by!(name: 'Fitzroy Gardens', address: 'Wellington Pde, East Melbourne', account: bob.account)
    event = Event.find_by!(title: 'Picnic', location_name: nil)
    expect(KornerAttachment.where(source_slug: 'kalendar', source_id: event.id, target_slug: 'map', target_id: place.id)).to exist
  end

  # Konnect → Map opens the map at once; with no pin, the address is
  # looked up.
  def new_place_in_picker(name, address)
    within('.attachment-picker') { click_on 'Map' }
    within('.map-pin-picker') do
      fill_in 'Name', with: name
      fill_in 'Address', with: address
      click_on 'Add place'
    end
    expect(page).to have_no_css('.attachment-picker')
    expect(page).to have_no_css('.map-pin-picker')
  end

  it "picks an existing Place from the map's list" do
    MapPlace.create!(name: 'Bondi Pavilion', address: 'Queen Elizabeth Dr, Bondi Beach', latitude: -33.891, longitude: 151.277, account: bob.account)
    visit '/hub/kalendar/composer'

    within('.compose-shell') { within('.konnect-row') { click_on 'Konnect' } }
    within('.attachment-picker') { click_on 'Map' }
    within('.map-pin-picker') { click_on 'Bondi Pavilion' }

    expect(page).to have_no_css('.map-pin-picker')
    expect(page).to have_css('.compose-shell .konnect-row .space-tile', text: 'Bondi Pavilion')
  end

  # decisions.md, 2026-10-25: Map opens straight away on a record's page
  # too, not a search list first, and Konnects the Place it picks.
  it "Konnects a Place from an event's page through the map" do
    place = MapPlace.create!(name: 'Bondi Pavilion', address: 'Queen Elizabeth Dr, Bondi Beach', latitude: -33.891, longitude: 151.277, account: bob.account)
    event = Event.create!(account: bob.account, title: 'Swim', start_time: 2.days.from_now, end_time: 2.days.from_now + 1.hour)
    visit "/hub/kalendar/#{event.id}"

    within('.attachment-section') { click_on 'Konnect' }
    within('.attachment-picker') { click_on 'Map' }
    expect(page).to have_no_css('.attachment-picker__search')
    within('.map-pin-picker') { click_on 'Bondi Pavilion' }

    expect(page).to have_no_css('.attachment-picker')
    expect(page).to have_css('.attachment-section .konnected-card--map', text: 'Bondi Pavilion')
    expect(KornerAttachment.where(source_slug: 'kalendar', source_id: event.id, target_slug: 'map', target_id: place.id)).to exist
  end

  # decisions.md, 2026-10-26: an event, its Krew and its album often share a
  # title, so each says what it is.
  it 'says what each Konnected record is when they share a title' do
    krew = Krew.create!(slug: 'ember', name: 'Ember', access: 'open')
    krew.krew_memberships.create!(account: bob.account, role: 'member', source: 'direct')
    event = Event.create!(account: bob.account, title: 'Ember', start_time: 2.days.from_now, end_time: 2.days.from_now + 1.hour)
    ember = Album.create!(owner: bob.account, title: 'Ember', visibility: :public)
    [['kalendar', event.id], ['krew', krew.id]].each do |slug, id|
      KornerAttachment.create!(source_slug: 'albutts', source_id: ember.id, target_slug: slug, target_id: id, kind: 'link', created_by_account: bob.account)
    end
    visit "/hub/albutts/albums/#{ember.id}"

    within('.attachment-section') do
      expect(page).to have_css('.konnected-card', text: /event.*Ember/mi)
      expect(page).to have_css('.space-tile', text: /Ember.*Krew/mi)
      expect(page).to have_button('Diskonnect the Ember event')
      expect(page).to have_button('Diskonnect the Ember Krew')
    end
  end

  # No Places yet, so no list to close first: one Escape closes the map.
  it 'closes the map back to the spaces on Escape, leaving the composer open' do
    visit '/hub/kalendar/composer'

    within('.compose-shell') { within('.konnect-row') { click_on 'Konnect' } }
    within('.attachment-picker') { click_on 'Map' }
    expect(page).to have_css('.map-pin-picker')
    find('.map-pin-picker__search-input').send_keys(:escape)

    expect(page).to have_no_css('.map-pin-picker')
    expect(page).to have_css('.attachment-picker .space-tile', text: 'Map')
    expect(page).to have_css('.compose-shell')
  end

  it 'opens on the record it was made from, which can be dropped' do
    visit "/hub/art/composer?konnect=albutts:#{album.id}"

    within('.konnect-row') do
      expect(page).to have_css('.space-tile', text: 'Studio days')
      click_on 'Diskonnect the Studio days album'
      expect(page).to have_no_css('.space-tile', text: 'Studio days')
    end
  end
end
