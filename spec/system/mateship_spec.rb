# frozen_string_literal: true

require 'rails_helper'

# The Mateship page (docs/spaces/profile.md, Mateship; decisions.md
# 2026-11-19 and 2026-11-20): a Mate's profile has labelled actions, and
# Mateship opens what the two of you share and your settings for them. Only
# the two Mates see it.
RSpec.describe 'Mateship', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:viewer) { bob.account }
  let!(:benjamin) { Fabricate(:account, username: 'benjamin', display_name: 'Benjamin') }
  let!(:chris)    { Fabricate(:account, username: 'chris', display_name: 'Chris') }

  def make_mates(one, other)
    one.follow!(other)
    other.follow!(one)
  end

  # A switch moves before the server answers; wait for what it kept.
  def kept_tune_outs
    Timeout.timeout(Capybara.default_max_wait_time) do
      loop do
        slugs = MateTuneOut.where(account: viewer, target_account: benjamin).pluck(:korner_slug)
        return slugs if yield(slugs)

        sleep 0.1
      end
    end
  end

  before do
    as_a_logged_in_user
    make_mates(viewer, benjamin)
    make_mates(viewer, chris)
    make_mates(benjamin, chris)
    krew = Fabricate(:krew, seeded_by: viewer, name: 'Garden Krew')
    krew.krew_memberships.create!(account: benjamin, role: 'member', source: 'direct')
    page.current_window.resize_to(390, 900)
  end

  it 'labels the actions on a Mate’s profile' do
    visit '/@benjamin'

    within('.profile-block__actions') do
      expect(page).to have_button('Mateship')
      expect(page).to have_button('Nudge')
      expect(page).to have_button('Post')
      expect(page).to have_button('Rose')
      expect(page).to have_button('Share')
    end
  end

  it 'opens what the two of you share from Mateship' do
    visit '/@benjamin'
    within('.profile-block__actions') { click_on 'Mateship' }

    expect(page).to have_current_path('/@benjamin/mateship')
    expect(page).to have_content('You and Benjamin')
    expect(page).to have_content('Mates since')
    expect(page).to have_content(/Mates in common/i)
    expect(page).to have_content('Chris')
    expect(page).to have_content('Garden Krew')
    expect(page).to have_css('h2', text: /What you see from Benjamin/i)
    expect(page).to have_css('h2', text: /What Benjamin sees of yours/i)
    expect(page).to have_content('Krew posts reach them in the Krews you share: Garden Krew.')
    expect(page).to have_no_link('Your settings for Benjamin')
  end

  it 'turns off one kind of post from a Mate, and back on' do
    visit '/@benjamin/mateship'

    toggle = find('input[aria-label="The Booth"]', visible: :all)
    expect(toggle).to be_checked
    toggle.find(:xpath, '..').click

    expect(page).to have_css('input[aria-label="The Booth"]:not(:checked)', visible: :all)
    expect(kept_tune_outs(&:any?)).to eq ['booth']

    # What the server kept, not just where the switch moved.
    visit '/@benjamin/mateship'
    expect(page).to have_css('input[aria-label="The Booth"]:not(:checked)', visible: :all)

    find('input[aria-label="The Booth"]', visible: :all).find(:xpath, '..').click
    expect(kept_tune_outs(&:empty?)).to be_empty
  end

  it 'mutes a Mate from the page' do
    visit '/@benjamin/mateship'

    find('input[aria-label="Mute Benjamin"]', visible: :all).find(:xpath, '..').click

    # The switch follows the relationship the server sends back.
    expect(page).to have_css('input[aria-label="Mute Benjamin"]:checked', visible: :all)
    expect(viewer.reload.muting?(benjamin)).to be true
  end

  it 'ends the mateship from the page, after asking' do
    visit '/@benjamin/mateship'

    within('.mateship__end') { click_on 'Remove Mate' }
    within('.confirm-dialog__panel') { click_on 'Remove' }

    expect(page).to have_current_path('/@benjamin')
    # Their profile offers to Mate again once the server has answered.
    expect(page).to have_button('Mate', exact: true)
    expect(viewer.reload.mate?(benjamin)).to be false
  end

  it 'sends a Mate’s settings page to the Mateship' do
    visit '/@benjamin/settings'

    expect(page).to have_current_path('/@benjamin/mateship')
  end

  it 'keeps the settings page for someone who isn’t your Mate' do
    Fabricate(:account, username: 'stranger', display_name: 'Stranger')

    visit '/@stranger/settings'

    expect(page).to have_current_path('/@stranger/settings')
    expect(page).to have_content('Settings for Stranger')
  end

  it 'opens the Mateship from your Mates list' do
    visit "/@#{viewer.username}/mates"

    find('.account', text: 'Benjamin').click_on('Mates')

    expect(page).to have_current_path('/@benjamin/mateship')
    expect(page).to have_content('You and Benjamin')
  end

  it 'sends someone who isn’t your Mate back to their profile' do
    # The API says 404 to anyone who isn't a Mate, and the browser logs it.
    ignore_js_error(/status of 404/)
    Fabricate(:account, username: 'stranger', display_name: 'Stranger')

    visit '/@stranger/mateship'

    expect(page).to have_current_path('/@stranger')
    expect(page).to have_no_button('Mateship')
  end
end
