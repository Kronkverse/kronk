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

  # docs/spaces/freethedream.md, The Krew (Tal, 2026-10-31): a projekt is
  # seeded from its Krew's page, so the composer has no Krew to pick, and
  # seeding is bare: a title, what it's about and a cover.
  it 'seeds a projekt only from a Krew, with just a title' do
    visit '/hub/freethedream/composer'
    expect(page).to have_current_path('/hub/krew/composer/projekt')

    within('.compose-shell') do
      fill_in placeholder: 'Title', with: 'Mini Doof'
      expect(page).to have_text('Seed it from the Krew page')
      expect(page).to have_no_select('Krew')
      expect(page).to have_no_text('When (optional)')
      expect(page).to have_no_text('Komponents to start with')
      expect(page).to have_no_text('What it needs')
      expect(page).to have_button('Seed', disabled: true)
    end
  end

  # docs/spaces/krew.md, Projekts: a Krew with no projekts has no section,
  # and its first is seeded from Konnect.
  it "starts a projekt from its Krew's page" do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    krew = Fabricate(:krew, seeded_by: bob.account, name: 'Mayhem')

    visit "/hub/krew/#{krew.slug}"
    expect(page).to have_css('.attachment-section')
    expect(page).to have_no_css('.krew-detail__projekts')
    within('.attachment-section') { click_on 'Konnect' }
    within('.attachment-picker') do
      click_on 'Projekts'
      click_on 'Seed a projekt'
    end

    expect(page).to have_no_select('Krew')
    fill_in placeholder: 'Title', with: 'Mini Doof'
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
    expect(Freethedream::Project.where(title: 'Kitchen')).to be_empty
  end

  # Kommons, 2026-11-08 (Komponent Cards, Join Button, Sections, Make an
  # event): Komponents are a row of cards, whoever makes one is in it, its
  # page has no lists, and Getting together has a + for the whole projekt.
  it 'shows Komponents as a row, puts their maker in them, and keeps the page plain' do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    make = find('.freethedream-section__add')
    expect(make[:href]).to include('konnect=freethedream')
    expect(page).to have_no_css('.freethedream-together select')
    expect(page).to have_no_text('needs met')

    click_on '+ Add a Komponent'
    within('.compose-shell') do
      fill_in placeholder: 'Sound, Design, Paperwork', with: 'Kitchen'
      click_on 'Add'
    end
    expect(page).to have_css('.freethedream-groups--row .freethedream-group', text: 'Kitchen')

    within('.freethedream-groups') { click_link 'Kitchen' }
    expect(page).to have_css('.korner-detail__title', text: 'Kitchen')
    expect(page).to have_css('.freethedream-join-gang', text: 'Joined')
    ['Thing Bringing', 'Actualise', 'On offer', 'Depends on'].each do |heading|
      expect(page).to have_no_css('.freethedream-section__title', text: heading)
    end
  end

  # Kommons, 2026-11-08: Kuestions are the projekt's alone. With its Krew's
  # Kuestions on, the projekt page has the row and a Komponent's page has none.
  it 'shows Kuestions on the projekt, not on its Komponents' do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew
    krew.krew_korners.create!(korner: 'kuestions')
    Freethedream::Project.create!(owner: bob.account, title: 'Kitchen', parent: doof, root: doof)

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    expect(page).to have_css('.home-kuestions__card--ask')

    within('.freethedream-groups') { click_link 'Kitchen' }
    expect(page).to have_css('.korner-detail__title', text: 'Kitchen')
    expect(page).to have_no_css('.home-kuestions')
  end

  # Tal, 2026-11-09: "event card on projekt should be standard".
  it "shows a projekt's events as standard cards, with Going", :aggregate_failures do
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew
    event = Event.create!(account: bob.account, title: 'Set-up day', start_time: 3.days.from_now, end_time: 3.days.from_now + 2.hours)
    KornerAttachment.create!(source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream', target_id: doof.id,
                             kind: 'link', created_by_account: bob.account)

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    within('.freethedream-together') do
      expect(page).to have_css('.standard-card .standard-card__title', text: 'Set-up day')
      expect(page).to have_css('.freethedream-together__date')
    end
  end
end
