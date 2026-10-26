# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Drafts: closing a composer keeps what was written, and it
# comes back when the composer opens again. Saving is silent: the drafts line
# shows only on a composer that picked a draft up.
RSpec.describe 'Composer drafts', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    # The home feed asks the Huddle server how full the room is; there is none here.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'keeps an event through closing the composer, and discards it on request' do
    visit '/hub/kalendar/new'
    find('input[placeholder="What is happening?"]').fill_in(with: 'Mayhem working bee')

    Timeout.timeout(Capybara.default_max_wait_time) do
      sleep 0.1 until Draft.find_by(account: bob.account, korner: 'kalendar', kind: 'event')&.params&.dig('title') == 'Mayhem working bee'
    end
    expect(page).to have_no_css('.draft-bar')

    find('.compose-shell__cancel').click
    expect(page).to have_no_css('.compose-shell')

    visit '/hub/kalendar/new'
    expect(page).to have_field(with: 'Mayhem working bee')
    expect(page).to have_css('.draft-bar', text: 'Picked up where you left off')

    within('.draft-bar') { click_on 'Discard' }
    within('.confirm-dialog') { click_on 'Discard draft' }

    expect(page).to have_no_field(with: 'Mayhem working bee')
    expect(page).to have_no_css('.draft-bar')
    expect(Draft.where(account: bob.account, korner: 'kalendar')).to be_empty
  end

  # decisions.md, 2026-10-25: New … from a record is a new thing for that
  # record. A recent draft's own Konnections coming back would Konnect it to
  # something else, and a Krew among them would make it that Krew's album.
  it 'opens clean when made from a record, leaving a recent draft parked' do
    krew = Krew.create!(slug: 'mayhem', name: 'Mayhem New Years', access: 'open')
    krew.krew_memberships.create!(account: bob.account, role: 'member', source: 'direct')
    event = Event.create!(account: bob.account, title: 'Swim', start_time: 2.days.from_now, end_time: 2.days.from_now + 1.hour)
    Draft.create!(account: bob.account, korner: 'albutts', kind: 'album',
                  params: { title: 'Ember', konnections: [{ slug: 'krew', id: krew.id.to_s, title: krew.name }] })

    visit "/hub/albutts/composer?konnect=kalendar:#{event.id}"

    within('.compose-shell') do
      expect(page).to have_css('.konnect-row .space-tile', text: 'Swim')
      expect(page).to have_no_css('.konnect-row .space-tile', text: 'Mayhem New Years')
      expect(page).to have_no_field(with: 'Ember')
    end
    expect(page).to have_css('.draft-bar', text: 'Drafts (1)')
  end

  it 'opens clean on a draft from more than half an hour ago, and offers it at the bottom' do
    Draft.create!(account: bob.account, korner: 'kalendar', kind: 'event', params: { title: 'Seed swap' })
         .update_columns(updated_at: 2.hours.ago)

    visit '/hub/kalendar/new'
    expect(page).to have_css('.draft-bar', text: 'Drafts (1)')
    expect(page).to have_no_field(with: 'Seed swap')
    expect(page).to have_no_css('.draft-bar', text: 'Picked up where you left off')

    within('.draft-bar') do
      click_on 'Drafts (1)'
      click_on 'Seed swap'
    end

    expect(page).to have_field(with: 'Seed swap')
    expect(page).to have_css('.draft-bar', text: 'Discard')
  end
end
