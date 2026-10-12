# frozen_string_literal: true

require 'rails_helper'

# Nudges has two faces on one barrel: Notifications at /nudges (where you
# land) and Messages at /nudges/messages. docs/spaces/nudges.md (Nudges spec)
# § Surfaces.
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
    expect(page).to have_css('h1', text: 'Notifications')
    expect(page).to have_css('.hub-switcher__badge', text: '1')
  end

  it 'lands on notifications, rolled up and in plain words' do
    visit '/nudges'

    expect(page).to have_css('h1', text: 'Notifications')
    expect(page).to have_content('Ben and 1 other frothed your post')
    expect(page).to have_content('Swell is up at the point')
    expect(page).to have_content('Ana wants to be Mates')
    # Two rows, not three: the two froths on one post are one row.
    expect(page).to have_css('.nudges-notification', count: 2)
    # Each row is badged: the froth heart, and the Mates mark (Mates has
    # no korner to take an icon from).
    expect(page).to have_css('.nudges-notification__badge', count: 2)
    # The froths are new; the Mate request was seen yesterday.
    expect(page).to have_css('.nudges-notification--fresh', count: 1)
  end

  it 'turns to messages and back' do
    visit '/nudges'

    # You land on notifications, so waiting messages are pointed out.
    expect(page).to have_link('1 unread message')

    click_on 'Next view'
    expect(page).to have_css('.nudges-messenger')
    expect(page).to have_current_path('/nudges/messages')
    # The messenger carries no notifications any more.
    expect(page).to have_no_css('.nudges-notification')

    # Messages wears the same turning title as every space. The bell that
    # used to lead back is gone.
    expect(page).to have_css('h1', text: 'Messages')
    expect(page).to have_no_css('.nudges-sidebar__notifications')

    click_on 'Next view'
    expect(page).to have_current_path('/nudges')
    expect(page).to have_css('h1', text: 'Notifications')
    # Opening the face the first time is what marked them seen.
    expect(page).to have_css('.nudges-notification', count: 2)
    expect(page).to have_no_css('.nudges-notification--fresh')
  end

  it 'lists chats with a name and the latest line, and finds one by name' do
    visit '/nudges/messages'

    within('.nudges-row') do
      expect(page).to have_content('Ana')
      expect(page).to have_content('Dawn patrol tomorrow?')
    end

    fill_in placeholder: 'Search chats', with: 'zzz'
    expect(page).to have_no_css('.nudges-row')
    expect(page).to have_content('No match')

    fill_in placeholder: 'Search chats', with: 'an'
    expect(page).to have_css('.nudges-row', count: 1)
  end

  it 'on a phone, opens a chat as its own page with the text box on screen' do
    page.current_window.resize_to(390, 800)
    visit '/nudges/messages'

    # The list is the whole page.
    expect(page).to have_css('h1', text: 'Messages')
    expect(page).to have_no_css('.nudges-conversation')

    find('.nudges-row__button').click

    # The chat takes over: its own row with the way back and the name, no
    # title row, no list.
    expect(page).to have_content('Dawn patrol tomorrow?')
    expect(page).to have_no_css('h1', text: 'Messages')
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
    expect(page).to have_current_path('/nudges/messages')
    expect(page).to have_css('.nudges-row')
  end

  it 'on a wide screen, keeps the list beside the open chat down to the bottom edge' do
    page.current_window.resize_to(1280, 800)
    visit "/nudges/with/#{ana.id}"

    expect(page).to have_content('Dawn patrol tomorrow?')
    expect(page).to have_css('.nudges-row')
    expect(page).to have_css('h1', text: 'Messages')
    expect(page).to have_no_link('Chats')

    edges = page.evaluate_script(<<~JS)
      (() => {
        const composer = document.querySelector('.nudges-composer').getBoundingClientRect();
        return { composer: composer.bottom, screen: window.innerHeight };
      })()
    JS
    expect(edges['composer']).to be_within(1.5).of(edges['screen'])
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
