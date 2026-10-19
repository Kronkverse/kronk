# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::PushWorker do
  let(:ana) { Fabricate(:user, time_zone: 'UTC').account }
  let(:bob) { Fabricate(:user, time_zone: 'UTC').account }

  let(:pushed_subscription_ids) { [] }

  before do
    # Midday UTC.
    travel_to(Time.utc(2026, 10, 19, 12, 0))
    allow(Nudges::WebPushWorker).to receive(:push_bulk) do |ids, &block|
      pushed_subscription_ids.concat(ids.map { |id| block.call(id).first })
    end
  end

  describe 'a notification' do
    let(:event) do
      Fabricate(:nudges_event, conversation: nil, actor_account: ana, recipient_account: bob, source_korner_slug: 'rose', verb: 'received')
    end

    it "goes to each of the recipient's subscriptions" do
      phone = Fabricate(:web_push_subscription, user: bob.user)
      laptop = Fabricate(:web_push_subscription, user: bob.user)

      described_class.new.perform('event', event.id)

      expect(pushed_subscription_ids).to contain_exactly(phone.id, laptop.id)
    end

    it 'stays off the phone when its row is turned off' do
      Fabricate(:web_push_subscription, user: bob.user)
      bob.user.settings[Nudges::PushPreferences::SETTING] = ['rose.received']
      bob.user.save!

      described_class.new.perform('event', event.id)

      expect(pushed_subscription_ids).to be_empty
    end

    it 'waits out quiet hours' do
      Fabricate(:web_push_subscription, user: bob.user)
      UserKornerSetting.create!(user: bob.user, korner_slug: 'nudges', values: { 'quiet_hours_start' => '22:00', 'quiet_hours_end' => '07:00' })
      bob.user.update!(time_zone: 'Sydney') # 23:00 there

      described_class.new.perform('event', event.id)

      expect(pushed_subscription_ids).to be_empty
    end
  end

  describe 'a chat message' do
    it 'goes to the other Mate, not the one who wrote it' do
      conversation = Fabricate(:nudges_conversation, one: ana, two: bob)
      mine = Fabricate(:web_push_subscription, user: ana.user)
      theirs = Fabricate(:web_push_subscription, user: bob.user)
      message = Fabricate(:nudges_conversation_message, conversation: conversation, author_account: ana)

      described_class.new.perform('message', message.id)

      expect(pushed_subscription_ids).to eq([theirs.id])
      expect(pushed_subscription_ids).to_not include(mine.id)
    end

    it 'skips a Krew member who muted the chat' do
      krew = Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: ana, last_activity_at: Time.current)
      [ana, bob].each { |account| krew.krew_memberships.create!(account: account, role: 'member', source: 'direct') }
      conversation = Nudges::Conversation.krew_for!(krew)
      conversation.memberships.find_by(account_id: bob.id).update!(muted: true)
      Fabricate(:web_push_subscription, user: bob.user)
      message = conversation.messages.create!(author_account: ana, body: 'Seeds are in')

      described_class.new.perform('message', message.id)

      expect(pushed_subscription_ids).to be_empty
    end
  end
end
