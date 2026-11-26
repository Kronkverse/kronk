# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/feed.md, What the feed shows: Home opens on Orbit unless the
# member picks another width in feed settings, and turning the title moves
# between widths without changing where it opens (Tal, 2026-11-11; Orbit
# default 2026-11-26).
RSpec.describe 'Where the feed opens', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  def title
    find('.scope-title .space-header__title')
  end

  it 'opens on Orbit, and a turn of the title is not kept' do
    visit '/home'
    expect(title).to have_text('Orbit')

    find('.scope-title__nav--next').click
    expect(title).to have_no_text('Orbit')

    visit '/home'
    expect(title).to have_text('Orbit')
    expect(bob.reload.settings['kronk.feed_opens_on']).to eq 'orbit'
  end

  it 'opens on the width chosen in feed settings' do
    visit '/home/settings'
    find('.feed-settings__scope-title', exact_text: 'Mates').click
    expect(page).to have_css('.feed-settings__scope-card--active .feed-settings__scope-title', exact_text: 'Mates')

    visit '/home'
    expect(title).to have_text('Mates')
    expect(bob.reload.settings['kronk.feed_opens_on']).to eq 'mates'
  end
end
