# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/klot.md, My cycle: log a period and how the day is, as it happens.
RSpec.describe 'Klot, my cycle', :inline_jobs, :js, :streaming do
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

  it 'starts a period, notes how the day is, and ends it' do
    visit '/hub/klot/mine'

    expect(page).to have_content('No period logged on this day.')
    click_on 'My period started today'
    expect(page).to have_content('Day 1 of your period')
    expect(page).to have_content('When your next period starts, Klot will know how long your cycle is.')

    click_on 'Heavy'
    click_on 'Cramps'
    expect(page).to have_css('.klot-chip[aria-pressed="true"]', text: 'Cramps')

    click_on 'My period ended today'
    expect(page).to have_content('Day 1 of a 1-day period')

    expect(CycleLog.find_by!(account: bob.account)).to have_attributes(length: 1)
    expect(CycleDay.find_by!(account: bob.account)).to have_attributes(flow: 'heavy', symptoms: %w(cramps))
  end
end
