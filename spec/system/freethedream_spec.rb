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
      click_on 'Gathering'
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

    # What kind of projekt it is comes first (Tal, 2026-11-10).
    expect(page).to have_text('What kind of projekt is it?')
    click_on 'Gathering'
    expect(page).to have_no_select('Krew')
    fill_in placeholder: 'Title', with: 'Mini Doof'
    click_on 'Seed'

    expect(page).to have_current_path(%r{\A/hub/krew/#{krew.slug}/p/})
    doof = Freethedream::Project.find_by(title: 'Mini Doof')
    expect(doof.krew).to eq krew
    expect(doof.kind).to eq 'gathering'
  end

  # docs/spaces/freethedream.md, Kinds: a projekt's kind suggests names for
  # its Komponents, to tap.
  it 'suggests Komponents from the projekt kind' do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account, kind: 'gathering')

    visit "/hub/krew/#{doof.reload.krew.slug}/p/#{doof.slug}"
    click_on '+ Add a Komponent'
    within('.compose-shell') do
      click_on 'Kitchen'
      expect(page).to have_field(placeholder: 'Sound, Design, Paperwork', with: 'Kitchen')
      click_on 'Add'
    end
    expect(page).to have_css('.freethedream-group', text: 'Kitchen')
  end

  # Kommons, 2026-11-10 (Projekts and Krew work): a Komponent's page is its
  # checklist. A To do is ticked off and anyone can say they're on it;
  # something to Bring is "I'll bring it".
  it "ticks off a To do on a Komponent's checklist", :aggregate_failures do
    visit_kitchen
    expect(page).to have_text('Nothing on it yet')
    within('.freethedream-checklist__add') do
      fill_in placeholder: 'Add something to do', with: 'Email the council'
      send_keys :enter
    end

    within('.freethedream-checklist__entry', text: 'Email the council') do
      click_on 'I’m on it'
      expect(page).to have_css(".people-row a[href='/@#{bob.account.username}']")
      check
    end
    expect(page).to have_css('.freethedream-checklist__entry--done', text: 'Email the council')
    expect(Freethedream::Item.find_by(title: 'Email the council')).to be_done
  end

  it "pays for something on a Komponent's checklist", :aggregate_failures do
    visit_kitchen
    within('.freethedream-checklist__add') do
      click_on 'Pay'
      fill_in placeholder: 'Add something to pay for', with: '$200 hall deposit'
      send_keys :enter
    end

    within('.freethedream-checklist__entry', text: 'hall deposit') do
      expect(page).to have_css('.freethedream-checklist__kind', text: 'Pay')
      expect(page).to have_css('.freethedream-checklist__amount', text: '$200')
      click_on 'I’ll pay it'
      check
    end
    expect(page).to have_text('$200 to pay, $200 of it paid')
    expect(Freethedream::Item.find_by(title: 'hall deposit')).to have_attributes(task: 'pay', quantity: 200, unit: '$', done?: true)
  end

  it "decides something on a Komponent's checklist", :aggregate_failures do
    visit_kitchen
    within('.freethedream-checklist__add') do
      click_on 'Decide'
      fill_in placeholder: 'Choices, or none for yes or no', with: 'Sat, Sun'
      fill_in placeholder: 'Add something to decide', with: 'Which day?'
      send_keys :enter
    end

    within('.freethedream-checklist__entry', text: 'Which day?') do
      expect(page).to have_css('.freethedream-checklist__kind', text: 'Decide')
      click_on 'Sun'
      expect(page).to have_css("button[aria-pressed='true']", text: /Sun\s*1/)
      check
    end
    expect(page).to have_css('.freethedream-checklist__state', text: 'Decided: Sun')
    expect(Freethedream::Item.find_by(title: 'Which day?')).to have_attributes(task: 'decide', done?: true)
  end

  it "brings something on a Komponent's checklist" do
    visit_kitchen
    within('.freethedream-checklist__add') do
      click_on 'Bring'
      fill_in placeholder: "Add what's needed", with: 'gas bottle'
      send_keys :enter
    end

    within('.freethedream-checklist__entry', text: 'gas bottle') do
      expect(page).to have_css('.freethedream-checklist__kind', text: 'Bring')
      click_on 'I’ll bring it'
    end
    expect(page).to have_css('.freethedream-checklist__entry--done', text: 'gas bottle')
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
  # page has no lists, and its Events have a + for the whole projekt.
  it 'shows Komponents as a row, puts their maker in them, and keeps the page plain' do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account, spaces: ['kalendar'])
    krew = doof.reload.krew

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    within('#projekt-space-kalendar') { expect(page).to have_button('New') }
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

  # Kommons, 2026-11-10 (Projekts and Krew work): a Komponent's card says
  # what it is, not how many, and its page shows who's in it as a row of
  # pictures under its description.
  it "shows a Komponent's description on its card and its people as a row", :aggregate_failures do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew
    Freethedream::Project.create!(title: 'Sound', description: 'Speakers, a desk and the long cable run', parent: doof, owner: bob.account)

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    expect(page).to have_css('.freethedream-group', text: 'Speakers, a desk and the long cable run')
    expect(page).to have_no_css('.freethedream-group', text: /person|people|fractal/)

    click_on '+ Add a Komponent'
    within('.compose-shell') do
      fill_in placeholder: 'Sound, Design, Paperwork', with: 'Kitchen'
      click_on 'Add'
    end
    within('.freethedream-groups') { click_link 'Kitchen' }

    expect(page).to have_css('.korner-detail__title', text: 'Kitchen')
    expect(page).to have_css(".people-row a[href='/@#{bob.account.username}']")
    expect(page).to have_no_text('Who’s in it')
  end

  # Kommons, 2026-11-08: Kuestions are the projekt's alone. With Kuestions
  # on, the projekt page has the row and a Komponent's page has none.
  it 'shows Kuestions on the projekt, not on its Komponents' do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account, spaces: ['kuestions'])
    krew = doof.reload.krew
    Freethedream::Project.create!(owner: bob.account, title: 'Kitchen', parent: doof, root: doof)

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    expect(page).to have_css('.home-kuestions__card--ask')

    within('.freethedream-groups') { click_link 'Kitchen' }
    expect(page).to have_css('.korner-detail__title', text: 'Kitchen')
    expect(page).to have_no_css('.home-kuestions')
  end

  # Tal, 2026-11-09: "event card on projekt should be standard", then the
  # same Events section as a Krew's.
  it "shows a projekt's events as a Krew's are", :aggregate_failures do
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew
    event = Event.create!(account: bob.account, title: 'Set-up day', start_time: 3.days.from_now, end_time: 3.days.from_now + 2.hours)
    KornerAttachment.create!(source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream', target_id: doof.id,
                             kind: 'link', created_by_account: bob.account)

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    within('#projekt-space-kalendar') do
      expect(page).to have_css('h3', text: /events/i)
      expect(page).to have_link('Set-up day')
    end
  end

  # docs/spaces/freethedream.md, A projekt's spaces (Tal, 2026-11-09): its
  # spaces work as a Krew's do.
  it 'turns a space on from Konnect, with a tile and a section', :aggregate_failures do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    expect(page).to have_css('.korner-detail__title', text: 'Mini Doof')
    expect(page).to have_no_css('.space-shelf')
    within('.attachment-section') { click_on 'Konnect' }
    within('.attachment-picker') { click_on 'Kronikles' }

    expect(page).to have_no_css('.attachment-picker')
    within('.space-shelf') do
      expect(page).to have_css('h3', text: /kronikles/i)
      expect(page).to have_button('New')
    end
    within('.attachment-section') { expect(page).to have_button('Kronikles') }
    expect(doof.reload.spaces).to eq ['kronikles']
  end

  it "arranges a projekt's sections from Edit" do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account, spaces: %w(kalendar kronikles))
    krew = doof.reload.krew

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    expect(page).to have_css('#projekt-space-kalendar h3', text: /events/i)
    find('.kronk-menu__trigger').click
    click_on 'Edit'
    within('.compose-shell') do
      expect(page).to have_css('.arrange-list__label', text: 'Events')
      click_on 'Move Activity up'
      click_on 'Save'
    end

    expect(page).to have_no_css('.compose-shell')
    expect(doof.reload.section_order).to eq %w(kalendar updates kronikles)
  end

  # docs/spaces/freethedream.md, Chat (Tal, 2026-11-09): Talk becomes the
  # projekt's own Nudges chat, turned on in Edit as a Krew's is in Settings.
  it 'turns its chat on from Edit and chats on the page', :aggregate_failures do
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    krew = doof.reload.krew

    visit "/hub/krew/#{krew.slug}/p/#{doof.slug}"
    expect(page).to have_css('.korner-detail__title', text: 'Mini Doof')
    expect(page).to have_no_css('.krew-detail__chat')
    expect(page).to have_no_field(placeholder: 'Start a thread')
    find('.kronk-menu__trigger').click
    click_on 'Edit'
    within('.compose-shell') do
      find('[role="switch"]').click
      click_on 'Save'
    end

    within('.krew-detail__chat') do
      find('.nudges-composer textarea').fill_in(with: 'Who has the urn?')
      click_button(class: 'nudges-composer__send')
      expect(page).to have_text('Who has the urn?')
    end
    within('.attachment-section') { expect(page).to have_button('Chat') }
    expect(Nudges::Conversation.find_by(kind: 'projekt', freethedream_project: doof).messages.last.body).to eq 'Who has the urn?'
  end

  def visit_kitchen
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account, kind: 'gathering')
    kitchen = Freethedream::Project.create!(title: 'Kitchen', parent: doof, owner: bob.account)
    visit "/hub/krew/#{doof.reload.krew.slug}/p/#{kitchen.slug}"
    expect(page).to have_css('.korner-detail__title', text: 'Kitchen')
  end
end
