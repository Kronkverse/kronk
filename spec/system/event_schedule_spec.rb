# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kalendar.md, Schedule (Tal, 2026-11-18): an event has one
# schedule. Konnected to a projekt, it's kept from the projekt's page and
# the event shows the same lines, as a grid with a column for each day.
RSpec.describe 'Event schedule', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:starts) { 5.days.from_now.change(hour: 10) }
  let(:event) do
    Event.create!(account: bob.account, title: 'Mini Doof', start_time: starts, end_time: starts + 1.day + 8.hours)
  end

  before { as_a_logged_in_user }

  def add_line(what, day:, start:, until_time: nil)
    click_on(page.has_button?('Add a schedule') ? 'Add a schedule' : 'Add')
    within('.compose-shell') do
      fill_in placeholder: 'What happens', with: what
      fill_in 'Day', with: day
      fill_in 'Starts', with: Time.zone.parse(start)
      fill_in 'Ends (optional)', with: Time.zone.parse(until_time) if until_time
      click_on 'Save'
    end
    expect(page).to have_no_css('.compose-shell')
  end

  def konnect_to_projekt
    doof = Freethedream::Project.create!(title: 'Doof crew', owner: bob.account)
    KornerAttachment.create!(source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream', target_id: doof.id,
                             kind: 'link', created_by_account: bob.account)
    doof
  end

  it "is kept from the projekt's page, a line at a time", :aggregate_failures do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = konnect_to_projekt

    visit "/hub/krew/#{doof.reload.krew.slug}/p/#{doof.slug}"
    within('.event-schedule--projekt') do
      expect(page).to have_link('Mini Doof')
      expect(page).to have_text('Nothing on the schedule yet.')
      add_line('Doors', day: starts.to_date, start: '10:00')
      add_line('Long table dinner', day: starts.to_date + 1, start: '18:30', until_time: '20:00')
      expect(page).to have_css('.event-schedule__day', count: 2)
    end
    expect(event.schedule_lines.pluck(:title)).to contain_exactly('Doors', 'Long table dinner')
  end

  it 'shows the same lines on the event, a column for each day', :aggregate_failures do
    konnect_to_projekt
    event.schedule_lines.create!(day: starts.to_date, start_minute: 600, title: 'Doors')
    event.schedule_lines.create!(day: starts.to_date + 1, start_minute: 1110, end_minute: 1200, title: 'Long table dinner')

    visit "/hub/kalendar/#{event.id}"
    within('#event-schedule') do
      expect(page).to have_text('Kept by the people in Doof crew.')
      expect(page).to have_css('.event-schedule__day', count: 2)
      expect(page).to have_css('.event-schedule__what', text: 'Long table dinner')
      expect(page).to have_text('until')
      find('.event-schedule__entry', text: 'Doors').click
    end
    within('.compose-shell') do
      fill_in placeholder: 'What happens', with: 'Doors open'
      click_on 'Save'
    end
    expect(page).to have_css('.event-schedule__what', text: 'Doors open')
    expect(event.schedule_lines.pluck(:title)).to contain_exactly('Doors open', 'Long table dinner')
  end

  it 'reads as a list on a one-day event, for its host to keep' do
    one_day = Event.create!(account: bob.account, title: 'Swim', start_time: starts, end_time: starts + 3.hours)
    one_day.schedule_lines.create!(day: starts.to_date, start_minute: 600, title: 'Warm up')

    visit "/hub/kalendar/#{one_day.id}"
    within('#event-schedule') do
      expect(page).to have_no_css('.event-schedule__day')
      expect(page).to have_css('.event-schedule__what', text: 'Warm up')
      expect(page).to have_button('Add')
    end
  end
end
