# frozen_string_literal: true

require 'rails_helper'

# docs/decisions.md, 2026-11-01 "Four sections": the pillars are YOU, Share,
# AWAWB, Explore and Join; Home is the screen in the middle; Nudges sits in
# the top bar beside search; the Hub page retired into Explore.
RSpec.describe 'Four sections', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  def pillar_names
    all('.hub-switcher--top .hub-switcher__pillar').map { |pillar| pillar['aria-label'] }
  end

  it 'has YOU, Share, AWAWB, Explore and Join as the pillars, and the wordmark goes Home' do
    page.current_window.resize_to(1400, 900)
    visit '/explore'

    expect(page).to have_css('.hub-switcher--top .hub-switcher__pillar', count: 5)
    expect(pillar_names).to eq ['YOU', 'Share', 'Always was, always will be', 'Explore', 'Join']
    expect(page).to have_css('.hub-switcher__pillar--active[aria-label="Explore"]')
    within('.kronk-frame__top-band .top-tools') { expect(page).to have_link('Nudges') }

    find('.kronk-frame__top-band .kronk-wordmark').click
    expect(page).to have_current_path('/home')
  end

  it 'sends the old Hub to Explore' do
    visit '/hub'

    expect(page).to have_current_path('/explore')
    expect(page).to have_css('.space-header__title', text: 'Explore')
  end

  it 'shows the ways to share, each opening its composer' do
    visit '/share'

    expect(page).to have_css('.space-header__title', text: 'Share')
    within('.section-page--share') do
      expect(page).to have_css('.space-card', text: 'Post')
      expect(page).to have_css('.space-card', text: 'Share a Moment')
      expect(page).to have_css('h2', text: /what you’ve shared/i)
    end

    find('.space-card', text: 'Post a piece').click
    expect(page).to have_current_path('/hub/art/composer')
  end

  it 'shows collections in Explore, and keeps every other korner reachable' do
    visit '/explore'

    within('.section-page--explore') do
      expect(page).to have_css('.space-card', text: 'Art')
      expect(page).to have_css('.space-card', text: 'Wachuneed')
      expect(page).to have_css('h2', text: /also on kronk/i)
      expect(page).to have_css('.space-card', text: 'Klot')
    end

    find('.space-card', text: 'Art').click
    expect(page).to have_current_path('/hub/art')
    find('.space-badge').click
    expect(page).to have_current_path('/explore')
  end

  it 'shows your Krews, Krews you could join, then when and where' do
    mine = Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: bob.account, last_activity_at: Time.current)
    mine.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
    other = Fabricate(:account)
    open = Krew.create!(slug: 'surfers', name: 'Surfers', access: 'open', seeded_by: other, last_activity_at: Time.current)
    open.krew_memberships.create!(account: other, role: 'seeder', source: 'direct')

    visit '/join'

    within('.section-page__krews') do
      expect(page).to have_css('.space-card', text: 'Growers')
      expect(page).to have_css('.space-card', text: 'Gather a Krew')
    end
    within('.section-page__discover') { expect(page).to have_css('.space-card', text: 'Surfers') }
    expect(page).to have_css('.space-card', text: 'Kalendar')
    expect(page).to have_css('.space-card', text: 'Map')

    find('.space-card', text: 'Growers').click
    expect(page).to have_current_path('/hub/krew/growers')
  end

  context 'with a phone' do
    before { page.current_window.resize_to(400, 800) }

    # A quick sideways swipe, as a finger makes it, from the middle of the
    # page.
    def swipe(direction)
      dx = direction == :right ? 160 : -160
      page.execute_script(<<~JS)
        (() => {
          const target = document.querySelector('.kronk-stage') || document.body;
          const at = (x) => new Touch({ identifier: 1, target, clientX: x, clientY: 400 });
          const start = 200, end = 200 + #{dx};
          target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [at(start)], changedTouches: [at(start)] }));
          target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [at(end)] }));
        })()
      JS
    end

    it 'has the pillars on the tab bar and Nudges at the top' do
      visit '/home'

      expect(page).to have_css('.hub-switcher--bottom .hub-switcher__item', count: 5)
      expect(page).to have_css('.kronk-frame__top-band .top-nudges', visible: :visible)
    end

    it 'swipes between the screens, Home in the middle' do
      visit '/home'
      expect(page).to have_css('.kronk-frame__top-band .top-nudges')

      swipe(:right)
      expect(page).to have_current_path('/share')
      swipe(:right)
      expect(page).to have_current_path('/me')
      swipe(:right)
      expect(page).to have_current_path('/me')

      visit '/home'
      expect(page).to have_css('.kronk-frame__top-band .top-nudges')
      swipe(:left)
      expect(page).to have_current_path('/explore')
      swipe(:left)
      expect(page).to have_current_path('/join')
    end
  end
end
