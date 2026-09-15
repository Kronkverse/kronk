# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Rose do
  # The day boundary is the feature. These lock it down in Sydney local
  # time on both sides of daylight saving, because the one mistake that
  # would matter here is hardcoding +10.
  describe '.current_day' do
    it 'returns the calendar date after 3am Sydney' do
      travel_to Time.utc(2026, 9, 15, 1, 0) do # 11:00 Sydney (AEST)
        expect(described_class.current_day).to eq Date.new(2026, 9, 15)
      end
    end

    it 'still returns yesterday at 2am Sydney' do
      travel_to Time.utc(2026, 9, 14, 16, 0) do # 02:00 Sydney, 15 Sept
        expect(described_class.current_day).to eq Date.new(2026, 9, 14)
      end
    end

    it 'rolls over at 3am Sydney' do
      travel_to Time.utc(2026, 9, 14, 17, 0) do # 03:00 Sydney, 15 Sept
        expect(described_class.current_day).to eq Date.new(2026, 9, 15)
      end
    end

    it 'follows daylight saving rather than a fixed offset' do
      # 16:30 UTC is 02:30 in AEST (+10) but 03:30 in AEDT (+11), so the
      # same clock time falls on different Kronk days across the switch.
      travel_to Time.utc(2026, 6, 14, 16, 30) do # winter: AEST
        expect(described_class.current_day).to eq Date.new(2026, 6, 14)
      end

      travel_to Time.utc(2026, 12, 14, 16, 30) do # summer: AEDT
        expect(described_class.current_day).to eq Date.new(2026, 12, 15)
      end
    end
  end

  describe '.today_for' do
    let(:recipient) { Fabricate(:account) }
    let(:sender)    { Fabricate(:account) }

    it "returns today's roses in arrival order and ignores older days" do
      travel_to Time.utc(2026, 9, 15, 1, 0) do
        older = Fabricate(:rose, to_account: recipient, sent_on: described_class.current_day - 1)
        first = Fabricate(:rose, to_account: recipient, from_account: sender)
        second = Fabricate(:rose, to_account: recipient)

        expect(described_class.today_for(recipient)).to eq [first, second]
        expect(described_class.today_for(recipient)).to_not include older
      end
    end
  end

  describe 'validations' do
    it 'refuses a rose to yourself' do
      account = Fabricate(:account)
      rose = described_class.new(from_account: account, to_account: account, sent_on: described_class.current_day)

      expect(rose).to_not be_valid
    end
  end
end
