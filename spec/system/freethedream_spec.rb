# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/freethedream.md (Page): the landing sits in <KornerShell>, so
# the Frame draws its view switch from the manifest's `views:`, the
# rotating title every other korner with views uses, not a row of pills.
RSpec.describe 'FreeTheDream', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  it "switches views with the Frame's rotating title, and draws no tab row of its own" do
    visit '/hub/freethedream'

    within('.scope-title') do
      expect(page).to have_css('h1.space-header__title', text: 'All emergences')
      expect(page).to have_css('.space-header__tagline', text: 'Every emergence on Kronk')
    end
    # The Frame's pillar bar is a tablist too; only the korner's own
    # surface (the Stage) must carry none.
    within('.kronk-stage') do
      expect(page).to have_no_css('.space-view-picker')
      expect(page).to have_no_css('[role="tablist"], [role="tab"]')
    end

    find('.scope-title__nav--next').click

    expect(page).to have_current_path('/hub/freethedream/mine')
    expect(page).to have_css('.scope-title h1.space-header__title', text: 'Mine')

    find('.scope-title__nav--next').click

    expect(page).to have_current_path('/hub/freethedream/mycelium')
    expect(page).to have_css('.scope-title h1.space-header__title', text: 'Mycelium')
    expect(page).to have_css('.scope-title .space-header__tagline', text: 'What you have to share')
  end

  it 'opens on the view its address names' do
    visit '/hub/freethedream/mine'

    expect(page).to have_css('.scope-title h1.space-header__title', text: 'Mine')
    expect(page).to have_css('.scope-title .space-header__tagline', text: "Emergences you're in")
  end
end
