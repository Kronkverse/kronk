# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, the search bar at the top of every screen.
RSpec.describe 'Top search bar', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  it 'takes what you type to the search page, with the space you were in' do
    page.current_window.resize_to(1400, 900)
    visit '/hub/wachuneed'

    bar = find('.top-search__input')
    bar.fill_in with: 'bike'
    bar.send_keys(:enter)

    expect(page).to have_current_path('/hub/search?q=bike&in=wachuneed')
    expect(page).to have_field(with: 'bike', class: 'kronk-search__input')
    expect(page).to have_no_css('.top-search')
  end

  it 'is there on a phone too, beside Nudges' do
    page.current_window.resize_to(400, 800)
    visit '/hub/wachuneed'

    within('.kronk-frame__top-band .top-tools') do
      expect(page).to have_css('.top-search__input', visible: :visible)
      expect(page).to have_link('Nudges')
    end
    find('.top-search__input').fill_in with: 'bike'
    find('.top-search__input').send_keys(:enter)

    expect(page).to have_current_path('/hub/search?q=bike&in=wachuneed')
  end
end
