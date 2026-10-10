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

  it 'lands on notifications, rolled up and in plain words' do
    visit '/nudges'

    expect(page).to have_css('h1', text: 'Notifications')
    expect(page).to have_content('Ben and 1 other frothed your post')
    expect(page).to have_content('Swell is up at the point')
    expect(page).to have_content('Ana wants to be Mates')
    # Two rows, not three: the two froths on one post are one row.
    expect(page).to have_css('.nudges-notification', count: 2)
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

    find('.nudges-sidebar__notifications').click
    expect(page).to have_current_path('/nudges')
    expect(page).to have_css('h1', text: 'Notifications')
    # Opening the face the first time is what marked them seen.
    expect(page).to have_css('.nudges-notification', count: 2)
    expect(page).to have_no_css('.nudges-notification--fresh')
  end

  it 'opens the chat with a person from their account id' do
    visit "/nudges/with/#{ana.id}"

    expect(page).to have_content('Dawn patrol tomorrow?')
    expect(page).to have_current_path(%r{\A/nudges/\d+\z})
  end
end
