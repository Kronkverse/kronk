# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Signup and the thresholds (Setup): after signup, five
# skippable steps save the theme, a bio, the default reach, mates and push.
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

  it 'saves the theme and a bio' do
    visit '/setup'
    expect(page).to have_css('.space-header__title', text: 'How Kronk looks')

    click_on 'Light'
    expect(page).to have_css('html[data-theme="light"]')
    expect(page).to have_css('.setup__choice[aria-pressed="true"]', text: 'Light')
    expect(bob.reload.settings['theme']).to eq 'mastodon-light'

    click_on 'Next'
    expect(page).to have_css('.space-header__title', text: 'About you')
    find('.profile-block__bio-input').fill_in(with: 'Grows tomatoes')
    click_on 'Next'
    Timeout.timeout(Capybara.default_max_wait_time) do
      sleep 0.1 until bob.account.reload.note.include?('Grows tomatoes')
    end
  end

  it 'saves the default reach, then goes Home after notifications' do
    visit '/setup#reach'
    expect(page).to have_css('.space-header__title', text: 'Who sees your posts')
    click_on 'Mates'
    Timeout.timeout(Capybara.default_max_wait_time) do
      sleep 0.1 until bob.reload.settings['default_privacy'] == 'mates'
    end

    click_on 'Next'
    expect(page).to have_css('.space-header__title', text: 'A few people')
    click_on 'Next'
    expect(page).to have_css('.space-header__title', text: 'Notifications')
    within('.setup__actions') { click_on 'Go Home' }
    expect(page).to have_current_path('/home')
  end
end
