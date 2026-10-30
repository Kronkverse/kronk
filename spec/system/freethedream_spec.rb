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

  # docs/spaces/freethedream.md, The Krew: Open the Krew goes to the Krew
  # made with the emergence, makes no other, and that Krew leads back.
  it "opens the emergence's own Krew, which leads back to it" do
    # The Krew page shows its people's avatars; a test account has none.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew

    visit "/hub/freethedream/p/#{doof.slug}"
    click_on 'Open the Krew'

    expect(page).to have_current_path("/hub/krew/#{krew.slug}")
    expect(page).to have_css('.space-tile', text: 'Mini Doof')
    expect(Krew.count).to eq 1

    find('.space-tile', text: 'Mini Doof').click
    expect(page).to have_current_path("/hub/freethedream/p/#{doof.slug}")
  end

  it 'opens on the view its address names' do
    visit '/hub/freethedream/mine'

    expect(page).to have_css('.scope-title h1.space-header__title', text: 'Mine')
    expect(page).to have_css('.scope-title .space-header__tagline', text: "Emergences you're in")
  end
end
