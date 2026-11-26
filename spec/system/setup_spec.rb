# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Signup and the thresholds (Setup): after signup, one page
# saves the shade, a bio, the default reach, mates and push as they're
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

  # Kronk is dark only for now (decisions.md, 2026-11-26): the look is the shade.
  it 'offers the shade but no light theme, and saves a bio' do
    visit '/setup'
    expect(page).to have_css('.space-header__title', text: 'Make Kronk yours')
    expect(page).to have_css('.setup__heading', text: 'How Kronk looks')
    expect(page).to have_no_button('Next')

    within('#look') do
      expect(page).to have_css('.setup__shade')
      expect(page).to have_no_button('Light')
    end
    expect(page).to have_css('html[data-theme="dark"]')

    within('#about') { find('.profile-block__bio-input').fill_in(with: 'Grows tomatoes') }
    find('#reach .setup__heading').click
    Timeout.timeout(Capybara.default_max_wait_time) do
      sleep 0.1 until bob.account.reload.note.include?('Grows tomatoes')
    end
  end

  it 'lists the spaces as the member stands and tunes out and back in' do
    visit '/setup'
    within('#spaces') do
      expect(page).to have_css('.setup__heading', text: 'Your spaces')
      row = find('.setup__space', text: 'Karporn')
      expect(row).to have_css('.settings-nav__row-desc', text: 'Photos of cars')
      expect(row).to have_css('.settings-nav__toggle[aria-pressed="true"]')
      # Kommons is opt-in: a new member starts tuned out of it.
      expect(find('.setup__space', text: 'Kommons')).to have_css('.settings-nav__toggle[aria-pressed="false"]')

      row.find('.settings-nav__toggle').click
      expect(row).to have_css('.settings-nav__toggle[aria-pressed="false"]')
    end
    Timeout.timeout(Capybara.default_max_wait_time) do
      sleep 0.1 until bob.account.korner_tune_outs.exists?(korner_slug: 'karporn')
    end

    within('#spaces') { find('.setup__space', text: 'Karporn').find('.settings-nav__toggle').click }
    Timeout.timeout(Capybara.default_max_wait_time) do
      sleep 0.1 until bob.account.tuned_in_to?('karporn')
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
