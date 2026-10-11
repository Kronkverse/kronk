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

    expect(page).to have_current_path('/hub/kommons/composer?node=menu.index')
  end

  it 'offers a proposal about Kommons itself from the Ж menu' do
    visit '/hub/kommons'

    find('.kronk-menu__trigger').click
    click_on 'Propose a change'

    expect(page).to have_current_path('/hub/kommons/composer?node=kommons.index')
  end
end
