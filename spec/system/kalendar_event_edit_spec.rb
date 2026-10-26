# frozen_string_literal: true

require 'rails_helper'

# decisions.md, 2026-10-27: editing an event is Kalendar's composer over the
# page, as for albums and films; the page keeps its Konnected section, and
# where an event is shows once, as its Place's card when it has one.
RSpec.describe 'Editing an event', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:starts) { 2.days.from_now.change(hour: 10, min: 0) }
  let(:place) { MapPlace.create!(name: 'Bondi Pavilion', address: 'Queen Elizabeth Dr, Bondi Beach', latitude: -33.891, longitude: 151.277, account: bob.account) }

  before { as_a_logged_in_user }

  def open_edit
    find('.kronk-menu__trigger').click
    find('.kronk-menu__moon[title="Edit event"]').click
    expect(page).to have_css('.compose-shell', text: 'Edit event')
  end

  def konnect_place(event, place)
    KornerAttachment.create!(source_slug: 'kalendar', source_id: event.id, target_slug: 'map', target_id: place.id, kind: 'link', created_by_account: bob.account)
  end

  it 'saves the title and description from the Kalendar composer, with Konnected still on the page' do
    event = Event.create!(account: bob.account, title: 'Swim', description: 'Early', start_time: starts, end_time: starts + 1.hour)
    visit "/hub/kalendar/#{event.id}"
    open_edit

    within('.compose-shell') do
      # Konnect is the page's, not the edit form's.
      expect(page).to have_no_css('.konnect-row')
      expect(page).to have_no_text('Invite people')
      find('.compose-title').set('Dawn swim')
      find('.compose-input--body').set('Bring a towel')
      click_on 'Save'
    end

    expect(page).to have_no_css('.compose-shell')
    expect(page).to have_css('.korner-detail', text: 'Dawn swim')
    expect(page).to have_css('.attachment-section')
    expect(event.reload).to have_attributes(title: 'Dawn swim', description: 'Bring a towel')
  end

  it "removes an older event's own address" do
    event = Event.create!(account: bob.account, title: 'Swim', start_time: starts, end_time: starts + 1.hour,
                          location_name: 'The rotunda', location_url: 'https://www.openstreetmap.org/?mlat=-33.87&mlon=151.21')
    visit "/hub/kalendar/#{event.id}"
    expect(page).to have_css('.event-detail__location', text: 'The rotunda')
    open_edit

    within('.event-composer__own-location') do
      expect(page).to have_text('The rotunda')
      click_on 'Remove'
    end
    within('.compose-shell') { click_on 'Save' }

    expect(page).to have_no_css('.compose-shell')
    expect(page).to have_no_css('.event-detail__location')
    expect(event.reload).to have_attributes(location_name: be_blank, location_url: be_blank)
  end

  it 'shows only the Place when the event also has an address of its own' do
    event = Event.create!(account: bob.account, title: 'Swim', start_time: starts, end_time: starts + 1.hour,
                          location_name: 'The rotunda', location_url: 'https://www.openstreetmap.org/?mlat=-33.87&mlon=151.21')
    konnect_place(event, place)
    visit "/hub/kalendar/#{event.id}"

    expect(page).to have_css('.attachment-section .konnected-card--map', text: 'Bondi Pavilion')
    expect(page).to have_no_css('.event-detail__location')
    expect(page).to have_no_css('.event-detail__map-preview')
  end
end
