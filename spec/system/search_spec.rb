# frozen_string_literal: true

require 'rails_helper'

# People come first in search, as cards with a Mate button, above the one
# mixed list (docs/decisions.md, 2026-10-11).
RSpec.describe 'Search', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    Fabricate(:account, username: 'tahlia', display_name: 'Tahlia Rivers')
  end

  it 'shows the people found as cards on top, each with a Mate button' do
    visit '/hub/search'

    fill_in 'Find people, posts, kategories…', with: 'tahlia'
    click_on 'Search'

    within('.kronk-search__people') do
      expect(page).to have_css('h2', text: /people/i)
      expect(page).to have_css('.kronk-search__person', count: 1)
      expect(page).to have_link('Tahlia Rivers', href: '/@tahlia')
      expect(page).to have_button('Mate?')
    end

    click_on 'Tahlia Rivers'

    expect(page).to have_current_path('/@tahlia')
  end
end
