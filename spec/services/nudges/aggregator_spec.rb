# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::Aggregator do
  let(:target) { Fabricate(:account) }
  let(:status) { Fabricate(:status, account: target) }

  def notif(type, actor, at:)
    Fabricate(:notification,
              account: target,
              from_account: actor,
              type: type,
              activity_type: 'Status',
              activity_id: status.id,
              created_at: at)
  end

  describe '.for' do
    it 'collapses same-type notifications on the same subject within the window' do
      a = Fabricate(:account)
      b = Fabricate(:account)
      c = Fabricate(:account)

      notifications = [
        notif(:favourite, a, at: Time.zone.parse('2026-07-10 12:00:00')),
        notif(:favourite, b, at: Time.zone.parse('2026-07-10 12:03:00')),
        notif(:favourite, c, at: Time.zone.parse('2026-07-10 12:05:00')),
      ]

      groups = described_class.for(notifications)
      expect(groups.size).to eq(1)
      expect(groups.first.count).to eq(3)
      expect(groups.first.actors).to contain_exactly(a, b, c)
    end

    it 'starts a new group when the window elapses' do
      a = Fabricate(:account)
      b = Fabricate(:account)

      notifications = [
        notif(:favourite, a, at: Time.zone.parse('2026-07-10 12:00:00')),
        notif(:favourite, b, at: Time.zone.parse('2026-07-10 12:15:00')),  # 15 min later — past 10-min default
      ]

      groups = described_class.for(notifications)
      expect(groups.size).to eq(2)
    end

    it 'keeps different types on the same subject as separate groups' do
      a = Fabricate(:account)

      notifications = [
        notif(:favourite, a, at: Time.zone.parse('2026-07-10 12:00:00')),
        notif(:reblog, a,   at: Time.zone.parse('2026-07-10 12:01:00')),
      ]

      groups = described_class.for(notifications)
      expect(groups.map(&:type)).to contain_exactly('favourite', 'reblog')
    end
  end
end
