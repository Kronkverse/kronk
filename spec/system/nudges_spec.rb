# frozen_string_literal: true

require 'rails_helper'

# Nudges is one space: the list of chats, led by Notifications, and whatever
# is open beside it (on a phone, over it). docs/spaces/nudges.md (Nudges
# spec) § Surfaces.
RSpec.describe 'Nudges', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:ana) { Fabricate(:account, username: 'ana', display_name: 'Ana') }
  let(:ben) { Fabricate(:account, username: 'ben', display_name: 'Ben') }
  let(:me)  { bob.account }

  def notify(actor, **attrs)
    Fabricate(:nudges_event, conversation: nil, recipient_account: me, actor_account: actor, **attrs)
  end

  before do
    as_a_logged_in_user

    post = Fabricate(:status, account: me, text: 'Swell is up at the point')
    notify(ana, source_korner_slug: 'feed', verb: 'frothed', source_type: 'Status', source_id: post.id, created_at: 2.hours.ago)
    notify(ben, source_korner_slug: 'feed', verb: 'frothed', source_type: 'Status', source_id: post.id, created_at: 1.hour.ago)
    notify(ana, source_korner_slug: 'mates', verb: 'mate_requested', interaction: 'interactive',
                cta_label: 'View profile', cta_route: '/@ana', created_at: 2.days.ago, seen_at: 1.day.ago)

    Fabricate(:follow, account: me, target_account: ana)
    Fabricate(:follow, account: ana, target_account: me)
    chat = Nudges::Conversation.mate_between!(me, ana)
    Fabricate(:nudges_conversation_message, conversation: chat, author_account: ana, body: 'Dawn patrol tomorrow?')
  end

  it 'shows how many are waiting on the Nudges pillar, and clears them when you look' do
    visit '/hub/rose'

    # One unread message and one unseen notification row (two froths).
    expect(page).to have_css('.hub-switcher__badge', text: /\A[23]\z/)

    visit '/nudges'
    expect(page).to have_css('.nudges-messenger__notifications .nudges-conversation__name', text: 'Notifications')
    expect(page).to have_css('.hub-switcher__badge', text: '1')
  end

  it 'opens on notifications on a wide screen, rolled up and in plain words' do
    visit '/nudges'

    expect(page).to have_css('.nudges-row--notifications.nudges-row--active')
    expect(page).to have_content('Ben and 1 other frothed your post')
    expect(page).to have_content('Swell is up at the point')
    expect(page).to have_content('Ana reckons you should be Mates')
    # Two rows, not three: the two froths on one post are one row.
    expect(page).to have_css('.nudges-notification', count: 2)
    # Each row is badged: the froth heart, and the Mates mark (Mates has
    # no korner to take an icon from).
    expect(page).to have_css('.nudges-notification__badge', count: 2)
    # The froths are new; the Mate request was seen yesterday.
    expect(page).to have_css('.nudges-notification--fresh', count: 1)
  end

  # Tal, 2026-11-23: notifications are "one chat space, persistently at the
  # top of the list", and the chats are beside it, "so its not swapping a page
  # to get to chats but just changing view".
  it 'keeps Notifications first in the list and changes the view beside it' do
    visit "/nudges/with/#{ana.id}"
    expect(page).to have_content('Dawn patrol tomorrow?')

    # First in the list, with what's new in it counted.
    expect(page).to have_css('.nudges-sidebar__list:first-of-type .nudges-row--notifications .nudges-row__badge', text: /\A[12]\z/)

    find('.nudges-row--notifications .nudges-row__button').click
    expect(page).to have_current_path('/nudges/notifications')
    expect(page).to have_css('.nudges-notification', count: 2)
    expect(page).to have_css('.nudges-notification--fresh', count: 1)
    # Opening it is what marks them seen.
    expect(page).to have_no_css('.nudges-row--notifications .nudges-row__badge')

    find('.nudges-row', text: 'Ana').click
    expect(page).to have_no_css('.nudges-notification')
    expect(page).to have_content('Dawn patrol tomorrow?')

    find('.nudges-row--notifications .nudges-row__button').click
    expect(page).to have_css('.nudges-notification', count: 2)
    expect(page).to have_no_css('.nudges-notification--fresh')
  end

  # Kommons "Notifications" (Tal, 2026-11-26): latest at the top. Reverses
  # the chat order of 2026-11-23.
  it 'lists notifications newest first, with earlier ones below', :aggregate_failures do
    45.times do |i|
      post = Fabricate(:status, account: me, text: "Old post #{i}")
      notify(ben, source_korner_slug: 'feed', verb: 'frothed', source_type: 'Status', source_id: post.id,
                  created_at: (3 + i).days.ago, seen_at: 1.day.ago)
    end
    visit '/nudges/notifications'

    # A page of them: the newest is the first row, the Mate request (older)
    # comes after the froths.
    expect(page).to have_css('.nudges-notification', minimum: 30)
    expect(page).to have_no_css('.nudges-notification', text: 'Old post 44')
    rows = all('.nudges-notification').map(&:text)
    expect(rows.first).to include('Ben and 1 other frothed your post')
    expect(rows.index { |t| t.include?('Ana reckons you should be Mates') }).to be > rows.index { |t| t.include?('Ben and 1 other') }

    click_on 'Show earlier'
    expect(page).to have_css('.nudges-notification', count: 47)
    expect(all('.nudges-notification').last.text).to include('Old post 44')
  end

  it 'lists chats with a name and the latest line, and finds one by name' do
    visit '/nudges/messages'

    chats = '.nudges-row:not(.nudges-row--notifications)'
    within(chats) do
      expect(page).to have_content('Ana')
      expect(page).to have_content('Dawn patrol tomorrow?')
    end

    fill_in placeholder: 'Search chats', with: 'zzz'
    expect(page).to have_no_css(chats)
    expect(page).to have_content('No match')
    # Notifications is not a chat to find; it stays put.
    expect(page).to have_css('.nudges-row--notifications')

    fill_in placeholder: 'Search chats', with: 'an'
    expect(page).to have_css(chats, count: 1)
  end

  it 'on a phone, opens a chat as its own page with the text box on screen' do
    page.current_window.resize_to(390, 800)
    visit '/nudges'

    # The list is the whole page, Notifications first; nothing is open.
    expect(page).to have_css('h1', text: 'Nudges')
    expect(page).to have_no_css('.nudges-conversation, .nudges-notification')

    find('.nudges-row', text: 'Ana').click

    # The chat takes over: its own row with the way back and the name, no
    # title row, no list.
    expect(page).to have_content('Dawn patrol tomorrow?')
    expect(page).to have_no_css('h1', text: 'Nudges')
    expect(page).to have_no_css('.nudges-row')
    expect(page).to have_link('Chats')

    # The composer ends where the pillar nav begins: not under it, and not
    # below the bottom of the screen.
    edges = page.evaluate_script(<<~JS)
      (() => {
        const composer = document.querySelector('.nudges-composer').getBoundingClientRect();
        const pillar = document.querySelector('.kronk-frame__bottom-band').getBoundingClientRect();
        return { composer: composer.bottom, pillar: pillar.top, screen: window.innerHeight };
      })()
    JS
    expect(edges['composer']).to be_within(1.5).of(edges['pillar'])
    expect(edges['composer']).to be <= edges['screen']

    click_on 'Chats'
    expect(page).to have_current_path('/nudges')
    expect(page).to have_css('.nudges-row', text: 'Ana')
  end

  it 'on a phone, opens Notifications from the top of the list, and back' do
    page.current_window.resize_to(390, 800)
    visit '/nudges'

    find('.nudges-row--notifications .nudges-row__button').click
    expect(page).to have_current_path('/nudges/notifications')
    expect(page).to have_css('.nudges-notification', count: 2)
    expect(page).to have_no_css('.nudges-row')

    click_on 'Chats'
    expect(page).to have_current_path('/nudges')
    expect(page).to have_css('.nudges-row--notifications')
  end

  it 'on a wide screen, keeps the list beside the open chat down to the bottom edge' do
    page.current_window.resize_to(1280, 800)
    visit "/nudges/with/#{ana.id}"

    expect(page).to have_content('Dawn patrol tomorrow?')
    expect(page).to have_css('.nudges-row--active', text: 'Ana')
    expect(page).to have_css('h1', text: 'Nudges')
    expect(page).to have_no_link('Chats')

    edges = page.evaluate_script(<<~JS)
      (() => {
        const composer = document.querySelector('.nudges-composer').getBoundingClientRect();
        return { composer: composer.bottom, screen: window.innerHeight };
      })()
    JS
    expect(edges['composer']).to be_within(1.5).of(edges['screen'])
  end

  # Tal, 2026-11-23: bubbles, and the emoji picker at the side of a message
  # (as in Signal), not a smiley under every one. Then: she couldn't see it at
  # all in a chat where only she had posted; you react to your own too. And
  # the time and read receipt go under the bubble, not in it.
  it 'puts the reaction control beside every bubble, yours too, and the time under it', :aggregate_failures do
    page.current_window.resize_to(390, 800)
    visit "/nudges/with/#{ana.id}"

    message = find('.nudges-msg', text: 'Dawn patrol tomorrow?')
    expect(message).to have_css('.nudges-msg__line > .nudges-msg__bubble + .nudges-msg__actions .emoji-picker-dropdown', visible: :all)
    expect(message).to have_no_css('.nudges-msg__reactions')
    expect(message).to have_no_css('.nudges-msg__bubble .nudges-msg__meta')
    expect(message).to have_css('.nudges-msg__main > .nudges-msg__meta')

    # Something you've sent: the smiley is there at rest, faintly; the bin
    # waits for a tap.
    find('.nudges-composer textarea').fill_in(with: 'See you at six')
    find('.nudges-composer textarea').send_keys(:enter)
    mine = find('.nudges-msg--out', text: 'See you at six')
    expect(mine).to have_css('.nudges-msg__react-add .emoji-picker-dropdown button', visible: :visible)
    expect(mine).to have_no_css('.nudges-msg__delete', visible: :visible)
    expect(mine).to have_css('.nudges-msg__main > .nudges-msg__meta')
    expect(page).to have_no_css('.nudges-msg--active')

    mine.find('.nudges-msg__body').click
    expect(page).to have_css('.nudges-msg--active', text: 'See you at six')
    expect(mine).to have_css('.nudges-msg__delete', visible: :visible)

    # A tap on the empty stream puts it away.
    page.execute_script("document.querySelector('.nudges-conversation__stream').click()")
    expect(page).to have_no_css('.nudges-msg--active')
  end

  it 'opens the chat with a person from their account id' do
    visit "/nudges/with/#{ana.id}"

    expect(page).to have_content('Dawn patrol tomorrow?')
    expect(page).to have_current_path(%r{\A/nudges/\d+\z})
  end

  it 'starts a new chat from the Ж menu' do
    visit '/nudges'

    find('.kronk-menu__trigger').click
    click_on 'New chat'

    within('.nudges-mate-picker') do
      expect(page).to have_css('h2', text: 'New chat')
      click_on 'ana'
    end

    expect(page).to have_current_path(%r{\A/nudges/\d+\z})
    expect(page).to have_content('Dawn patrol tomorrow?')
  end
end
