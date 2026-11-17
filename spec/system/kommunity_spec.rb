# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kommunity.md, Kommunity (the first page). Tal, 2026-11-17.
RSpec.describe 'Kommunity', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email) { 'test@example.com' }
  let(:password) { 'password' }
  let(:confirmed_at) { Time.zone.now }
  let(:finished_onboarding) { true }

  def member(username, name, findable: :everyone)
    Fabricate(:account, username: username, display_name: name).tap do |account|
      account.user.update!(current_sign_in_at: 1.day.ago)
      account.update!(kommunity_discoverability: findable)
    end
  end

  def mates!(one, other)
    one.follow!(other)
    other.follow!(one)
  end

  before do
    as_a_logged_in_user
    # Fabricated accounts have no avatar file in test.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    viewer = bob.account

    mate = member('mate', 'Mo Mate')
    mates!(viewer, mate)

    # A Mate of a Mate, also in the viewer's Krew: shows once, as Orbit.
    orbiter = member('orbiter', 'Ola Orbit')
    mate.follow!(orbiter)

    krewmate = member('krewmate', 'Kit Krew')
    krew = Krew.create!(slug: 'gardeners', name: 'Gardeners', access: 'open')
    krew.krew_memberships.create!(account: viewer, role: 'seeder', source: 'direct')
    krew.krew_memberships.create!(account: krewmate, role: 'member', source: 'direct')
    krew.krew_memberships.create!(account: orbiter, role: 'member', source: 'direct')

    member('stranger', 'Sam Stranger')
  end

  it 'opens on a Discover row of Orbit, then Krews, then Kronkers, each person once' do
    visit '/hub/kommunity'

    within('section[aria-label="Discover"]') do
      expect(page).to have_css('.space-card__title', text: 'Sam Stranger')
      titles = all('.space-card__title').map(&:text)
      expect(titles).to eq ['Orbit', 'Ola Orbit', 'Krews', 'Kit Krew', 'Kronkers', 'Sam Stranger']
    end
  end

  it 'lists everyone A to Z under it, saying where you stand as Mates' do
    visit '/hub/kommunity'

    within('.kommunity-everyone__list') do
      expect(page).to have_css('.account', text: 'Sam Stranger')
      expect(all('.account .display-name__html').map(&:text)).to eq ['Kit Krew', 'Mo Mate', 'Ola Orbit', 'Sam Stranger']
      expect(find('.account', text: 'Mo Mate')).to have_css('.account__mates-marker', text: 'Mates')
      expect(find('.account', text: 'Sam Stranger')).to have_button('Mate')
    end
  end

  it 'takes the old Everyone and Discover addresses to the first page' do
    visit '/hub/kommunity/everyone'

    expect(page).to have_css('section[aria-label="Discover"]')
    expect(page).to have_current_path('/hub/kommunity')
  end
end
