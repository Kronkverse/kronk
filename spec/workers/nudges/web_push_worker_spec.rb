# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/nudges.md (Push): what one push carries, for "Each one" and
# for "Just a ping".
RSpec.describe Nudges::WebPushWorker do
  let(:worker) { described_class.new }

  let(:ana) { Fabricate(:account, display_name: 'Ana') }
  let(:bob) { Fabricate(:user).account }
  let(:subscription) { Fabricate(:web_push_subscription, user: bob.user) }
  let(:sent) { [] }

  let(:event) do
    Fabricate(:nudges_event, conversation: nil, actor_account: ana, recipient_account: bob, source_korner_slug: 'rose', verb: 'received')
  end

  before do
    # The encryption and request are Web::PushNotificationWorker's; this is
    # about what goes into them.
    allow(worker).to receive(:perform_standard_request) { sent << JSON.parse(worker.send(:push_notification_json)) }
    allow(worker).to receive(:perform_legacy_request) { sent << JSON.parse(worker.send(:push_notification_json)) }
  end

  def choose(style)
    bob.user.settings[Nudges::PushPreferences::STYLE_SETTING] = style
    bob.user.save!
  end

  it 'says who did what by default' do
    worker.perform(subscription.id, 'event', event.id)

    expect(sent.sole).to include('title' => 'Ana sent you a rose', 'tag' => "nudge-#{event.id}")
    expect(sent.sole).to_not have_key('ping')
  end

  it 'sends just a ping, with no name, words or picture, under one tag' do
    choose('ping')

    worker.perform(subscription.id, 'event', event.id)

    expect(sent.sole).to include(
      'ping' => true,
      'title' => 'Something new on Kronk',
      'body' => nil,
      'icon' => nil,
      'url' => '/nudges',
      'tag' => Nudges::PushPayload::PING_TAG
    )
    expect(sent.sole.values.join(' ')).to_not include('Ana')
  end

  it 'pings for a chat message too, never naming who wrote' do
    choose('ping')
    conversation = Fabricate(:nudges_conversation, one: ana, two: bob)
    message = Fabricate(:nudges_conversation_message, conversation: conversation, author_account: ana, body: 'secret plans')

    worker.perform(subscription.id, 'message', message.id)

    expect(sent.sole).to include('title' => 'Something new on Kronk', 'tag' => Nudges::PushPayload::PING_TAG)
    expect(sent.sole.values.join(' ')).to_not include('Ana', 'secret')
  end

  it 'pings for a legacy notification that NotifyService routes here' do
    choose('ping')
    notification = Fabricate(:notification, account: bob)

    worker.perform(subscription.id, 'notification', notification.id)

    expect(sent.sole).to include('ping' => true, 'tag' => Nudges::PushPayload::PING_TAG)
  end
end
