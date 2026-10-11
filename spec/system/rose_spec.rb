# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/rose.md § The surface: a rose can be sent from /hub/rose,
# through the Ж menu, to any Mate.
RSpec.describe 'Rose', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:ana) { Fabricate(:account, username: 'ana', display_name: 'Ana') }

  before do
    as_a_logged_in_user
    Fabricate(:follow, account: bob.account, target_account: ana)
    Fabricate(:follow, account: ana, target_account: bob.account)
  end

  it 'sends a rose to a Mate from the Ж menu, once' do
    visit '/hub/rose'

    find('.kronk-menu__trigger').click
    click_on 'Send a rose'

    within('.nudges-mate-picker') do
      expect(page).to have_css('h2', text: 'Send a rose')
      click_on 'Ana'

      expect(page).to have_button('Ana', disabled: true)
      expect(page).to have_content('Sent today')
    end

    expect(page).to have_content('You sent Ana a rose.')
    expect(Rose.where(from_account: bob.account, to_account: ana).count).to eq 1
  end
end
