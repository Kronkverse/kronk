# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Scheduler::RoseSweepScheduler do
  let(:sender)    { Fabricate(:account) }
  let(:recipient) { Fabricate(:account) }

  it "deletes yesterday's roses and their notifications, and keeps today's" do
    sender.follow!(recipient)
    recipient.follow!(sender)
    other = Fabricate(:account)
    other.follow!(recipient)
    recipient.follow!(other)

    travel_to Time.utc(2026, 9, 15, 1, 0) do
      Rose::SendService.new(sender, recipient).call
    end

    travel_to Time.utc(2026, 9, 16, 1, 0) do
      today = Rose::SendService.new(other, recipient).call

      described_class.new.perform

      expect(Rose.all).to eq [today]
      expect(Nudges::Event.where(source_korner_slug: 'rose').pluck(:actor_account_id)).to eq [other.id]
    end
  end
end
