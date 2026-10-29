# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kommons.md: choosing what a proposal is about.
RSpec.describe 'Kommons', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  it 'finds Kommons and the floating menu when choosing the page a proposal is about' do
    visit '/hub/kommons/pick'

    fill_in 'Search for a page…', with: 'kommons'
    expect(page).to have_css('.propose-picker__result', text: 'Proposals')

    fill_in 'Search for a page…', with: 'floating'
    find('.propose-picker__result', text: 'Floating menu').click

    # The composer opens over the picker, about the page chosen.
    expect(page).to have_css('.compose-shell', text: 'Floating menu')
    expect(page).to have_current_path('/hub/kommons/pick')
  end

  # Everyone starts tuned out of Kommons; that is about the feed, not the way in.
  it 'stays in the sidebar for someone tuned out of it' do
    expect(bob.account.tuned_in_to?('kommons')).to be(false)

    visit '/hub/rose'

    expect(page).to have_css('.korner-sidebar a[href="/hub/kommons"]')
  end

  it 'goes back from a proposal to the list it was opened from' do
    Fabricate(:proposal, created_by_account: bob.account, title: 'Longer days')

    visit '/hub/kommons/open'
    find('.kommons-proposal', text: 'Longer days').click
    expect(page).to have_css('.kommons-detail', text: 'Longer days')

    find('.space-badge').click

    expect(page).to have_current_path('/hub/kommons/open')
  end

  it 'returns to the space a proposal was made from' do
    visit '/hub/rose'

    find('.kronk-menu__trigger').click
    click_on 'Propose a change'
    # A title and what should change: there is no summary box.
    expect(page).to have_no_field('One line that sums it up')
    fill_in 'A short, clear title', with: 'More roses'
    fill_in 'What should change, and why?', with: 'One a day is not enough.'
    click_on 'Open it'

    expect(page).to have_current_path('/hub/rose')
    expect(page).to have_content('Your proposal is open')
    expect(Proposal.find_by(title: 'More roses')).to be_present
  end

  it 'lands on the list of proposals, with the tree a face of its own' do
    Fabricate(:proposal, created_by_account: bob.account, title: 'Longer days')

    visit '/hub/kommons'
    expect(page).to have_css('.kommons-proposal', text: 'Longer days')

    visit '/hub/kommons/directory'
    expect(page).to have_css('.kommons-lattice')
    expect(page).to have_no_css('.kommons-proposal')
  end

  it 'offers a proposal about Kommons itself from the Ж menu' do
    visit '/hub/kommons'

    find('.kronk-menu__trigger').click
    click_on 'Propose a change'

    expect(page).to have_css('.compose-shell', text: 'Propose a change to Proposals')
    expect(page).to have_current_path('/hub/kommons')
  end

  # Kommons "Proposer Composer" (decisions.md, 2026-10-29): the composer
  # opens over the page you are on, and cancelling leaves you there.
  it 'opens the composer over the page you are on, and cancelling stays there' do
    visit '/hub/rose'
    expect(page).to have_css('.kronk-menu__trigger')

    find('.kronk-menu__trigger').click
    click_on 'Propose a change'

    expect(page).to have_css('.compose-shell')
    expect(page).to have_current_path('/hub/rose')

    within('.compose-shell') { click_on 'Cancel' }

    expect(page).to have_no_css('.compose-shell')
    expect(page).to have_current_path('/hub/rose')
  end

  it 'proposes a new korner from the Hub without leaving it' do
    visit '/hub'

    find('.hub-page__tile--propose .hub-page__tile-link').click

    expect(page).to have_css('.compose-shell', text: 'Propose a new Korner')
    expect(page).to have_current_path('/hub')

    find('.compose-shell__close').click

    expect(page).to have_no_css('.compose-shell')
    expect(page).to have_current_path('/hub')
  end

  it 'claims an open proposal from its tile, and joins one somebody else has claimed' do
    mine = Fabricate(:proposal, created_by_account: Fabricate(:account), title: 'Longer days')
    theirs = Fabricate(:proposal, created_by_account: Fabricate(:account), title: 'Shorter nights')
    Kronk::ProposalStates.claim!(theirs, by: Fabricate(:account, username: 'pargo'))

    visit '/hub/kommons/open'

    # Once you are on a proposal its tile has nothing left to offer, so the
    # button goes.
    # The buttons are part of the card, along its bottom edge.
    expect(page).to have_css('.kommons-proposal-closable > .kommons-proposal-closable__actions button', text: 'Claim')
    within('.kommons-proposal-closable', text: 'Longer days') { click_on 'Claim' }
    expect(page).to have_content("@#{bob.account.username} is building this")

    within('.kommons-proposal-closable', text: 'Shorter nights') { click_on 'Join' }
    expect(page).to have_content('@pargo and 1 other are building this')

    expect(page).to have_no_button('Claim')
    expect(page).to have_no_button('Join')

    expect(mine.reload.claimed_by_account).to eq(bob.account)
    expect(theirs.reload.joined_accounts).to eq([bob.account])
  end

  it 'closes your own actioned proposal from its tile on the board' do
    proposal = Fabricate(:proposal, created_by_account: bob.account, title: 'Longer days', status: :actioned)

    visit '/hub/kommons/open'
    expect(page).to have_css('.kommons-proposal', text: 'Longer days')
    click_on 'Close proposal'

    expect(page).to have_css('.kommons-proposal--closed', text: 'Longer days')
    expect(page).to have_no_button('Close proposal')
    expect(proposal.reload).to be_closed
  end
end
