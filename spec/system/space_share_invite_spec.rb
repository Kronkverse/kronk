# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Share and Invite: on every page of every space.
RSpec.describe 'Share and Invite', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:mate)                { Fabricate(:user, account_attributes: { username: 'pargo' }).account }

  before do
    as_a_logged_in_user
    bob.account.follow!(mate)
    mate.follow!(bob.account)
  end

  it 'invites a Mate to a space from the Ж menu' do
    visit '/hub/wachuneed'

    find('.kronk-menu__trigger').click
    expect(page).to have_no_css('.space-header-row__right button', text: 'Invite')
    click_on 'Invite'
    find('.nudges-mate-picker__row', text: 'pargo').click

    expect(page).to have_css('.nudges-mate-picker__row-done', text: 'Invited')
    expect(Nudges::Event.find_by(recipient_account_id: mate.id, verb: 'invited'))
      .to have_attributes(source_korner_slug: 'wachuneed', cta_route: '/hub/wachuneed')
  end

  it 'offers Share in the Ж menu, with the page\'s link to copy' do
    visit '/hub/kommons'

    find('.kronk-menu__trigger').click
    click_on 'Share'

    expect(page).to have_button('Copy link')
  end
end
