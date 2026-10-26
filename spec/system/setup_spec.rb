# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Signup and the thresholds (Setup): after signup, one page
# saves the theme, a bio, the default reach, mates and push as they're
# picked, and Continue goes Home.
RSpec.describe 'Setup after signup', :js, :streaming do
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

  it 'saves the theme, back at the look section, and a bio' do
    visit '/setup'
    expect(page).to have_css('.space-header__title', text: 'Make Kronk yours')
    expect(page).to have_css('.setup__heading', text: 'How Kronk looks')
    expect(page).to have_no_button('Next')

    within('#look') { click_on 'Light' }
    expect(page).to have_css('html[data-theme="light"]')
    expect(page).to have_css('#look .setup__choice[aria-pressed="true"]', text: 'Light')
    expect(page.evaluate_script('window.location.hash')).to eq '#look'
    expect(bob.reload.settings['theme']).to eq 'mastodon-light'

    within('#about') { find('.profile-block__bio-input').fill_in(with: 'Grows tomatoes') }
    find('#reach .setup__heading').click
    Timeout.timeout(Capybara.default_max_wait_time) do
      sleep 0.1 until bob.account.reload.note.include?('Grows tomatoes')
    end
  end

  it 'saves the default reach, then Continue goes Home' do
    visit '/setup'
    within('#reach') { click_on 'Mates' }
    Timeout.timeout(Capybara.default_max_wait_time) do
      sleep 0.1 until bob.reload.settings['default_privacy'] == 'mates'
    end

    expect(page).to have_css('.setup__heading', text: 'A few people')
    expect(page).to have_css('.setup__heading', text: 'Notifications')
    click_on 'Continue'
    expect(page).to have_current_path('/home')
  end
end
