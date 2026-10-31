# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/freethedream.md: Projekts live inside Krews (Tal,
# 2026-10-30). A projekt's pages sit under its Krew, and there is no list
# of every projekt.
RSpec.describe 'Projekts', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  it 'sends the old list, its views and settings to your Krews' do
    visit '/hub/freethedream'
    expect(page).to have_current_path('/hub/krew')

    visit '/hub/freethedream/mine'
    expect(page).to have_current_path('/hub/krew')

    visit '/hub/freethedream/settings'
    expect(page).to have_current_path('/hub/krew')
  end

  # docs/spaces/freethedream.md, The Krew: an emergence lives in one of your
  # Krews, and the Krew page shows it.
  it 'starts an emergence in one of your Krews, and the Krew page shows it' do
    krew = Fabricate(:krew, seeded_by: bob.account, name: 'Mayhem')

    visit '/hub/freethedream/composer'
    expect(page).to have_current_path('/hub/krew/composer/projekt')
    fill_in placeholder: 'A doof, an album, an app, a co-op…', with: 'Mini Doof'
    expect(page).to have_button('Seed', disabled: true)
    select 'Mayhem', from: 'Krew'
    click_on 'Seed'

    expect(page).to have_current_path(%r{\A/hub/krew/#{krew.slug}/p/})
    expect(Freethedream::Project.find_by(title: 'Mini Doof').krew).to eq krew

    visit "/hub/krew/#{krew.slug}"
    expect(page).to have_css('.krew-detail__projekts .space-card', text: 'Mini Doof', wait: 20)
  end

  # docs/spaces/krew.md, Projekts: the Krew page's New projekt starts one in
  # that Krew.
  it "starts a projekt from its Krew's page" do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    krew = Fabricate(:krew, seeded_by: bob.account, name: 'Mayhem')

    visit "/hub/krew/#{krew.slug}"
    find('.krew-detail__projekts .space-card', text: 'New projekt', wait: 20).click

    expect(page).to have_select('Krew', selected: 'Mayhem')
    fill_in placeholder: 'A doof, an album, an app, a co-op…', with: 'Mini Doof'
    click_on 'Seed'

    expect(page).to have_current_path(%r{\A/hub/krew/#{krew.slug}/p/})
    expect(Freethedream::Project.find_by(title: 'Mini Doof').krew).to eq krew
  end

  # docs/spaces/freethedream.md, The Krew: the space badge goes to the Krew
  # made with the projekt, makes no other, and that Krew leads back.
  it "opens the emergence's own Krew, which leads back to it" do
    # The Krew page shows its people's avatars; a test account has none.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew

    # An old address (a notification, a link preview) moves under its Krew.
    visit "/hub/freethedream/p/#{doof.slug}"
    expect(page).to have_current_path("/hub/krew/#{krew.slug}/p/#{doof.slug}")
    # No Krew row of its own: it is part of the Krew.
    expect(page).to have_no_css('.freethedream-dreamers')
    find('.space-badge', text: krew.name).click

    expect(page).to have_current_path("/hub/krew/#{krew.slug}")
    expect(page).to have_css('.krew-detail__projekts .space-card', text: 'Mini Doof')
    expect(Krew.count).to eq 1

    find('.krew-detail__projekts .space-card', text: 'Mini Doof').click
    expect(page).to have_current_path("/hub/krew/#{krew.slug}/p/#{doof.slug}")

    # Back from a projekt is its Krew, not the list of every projekt.
    expect(page).to have_css('.space-badge__name', text: krew.name)
    find('.space-badge').click
    expect(page).to have_current_path("/hub/krew/#{krew.slug}")
  end

  # docs/spaces/freethedream.md, Komponents (Tal, 2026-10-31): adding a
  # Komponent is its name and what it is about, and whoever made it can
  # remove it again from the menu.
  it 'adds a Komponent with just a name, and removes it from the menu' do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    click_on '+ Add a Komponent'
    within('.compose-shell') do
      expect(page).to have_no_text('Fractals to start with')
      expect(page).to have_no_text('What it needs')
      expect(page).to have_no_css('.konnect-row')
      fill_in placeholder: 'Sound, Design, Paperwork', with: 'Kitchen'
      click_on 'Add'
    end

    expect(page).to have_no_css('.compose-shell')
    within('.freethedream-groups') { click_link 'Kitchen' }
    expect(page).to have_css('.korner-detail__title', text: 'Kitchen')
    find('.kronk-menu__trigger').click
    find('.kronk-menu__moon[title="Remove"]').click
    within('.confirm-dialog__panel') { click_on 'Remove' }

    expect(page).to have_current_path("/hub/krew/#{krew.slug}/p/#{doof.slug}")
    expect(page).to have_no_css('.freethedream-group', text: 'Kitchen')
    expect(Freethedream::Project.where(title: 'Kitchen')).to be_empty
  end
end
