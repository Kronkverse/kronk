# frozen_string_literal: true

require 'rails_helper'

# The Mateship page (docs/spaces/profile.md, Mateship; decisions.md
# 2026-11-19): a Mate's profile has labelled actions, and Mates opens what
# the two of you share. Only the two Mates see it.
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

  before do
    as_a_logged_in_user
    make_mates(viewer, benjamin)
    make_mates(viewer, chris)
    make_mates(benjamin, chris)
    krew = Fabricate(:krew, seeded_by: viewer, name: 'Garden Krew')
    krew.krew_memberships.create!(account: benjamin, role: 'member', source: 'direct')
    page.current_window.resize_to(390, 900)
  end

  it 'labels the actions on a Mate’s profile and opens the Mateship from Mates' do
    visit '/@benjamin'

    within('.profile-block__actions') do
      expect(page).to have_button('Nudge')
      expect(page).to have_button('Post')
      expect(page).to have_button('Rose')
      expect(page).to have_button('Share')
      click_on 'Mates'
    end

    expect(page).to have_current_path('/@benjamin/mateship')
    expect(page).to have_content('You and Benjamin')
    expect(page).to have_content('Mates since')
    expect(page).to have_content(/Mates in common/i)
    expect(page).to have_content('Chris')
    expect(page).to have_content('Garden Krew')
    expect(page).to have_link('Your settings for Benjamin', href: '/@benjamin/settings')
    expect(page).to have_no_content('Remove Mate')
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
    expect(page).to have_no_button('Mates')
  end
end
