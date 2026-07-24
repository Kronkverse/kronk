# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CycleLog do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'requires started_on' do
      expect(described_class.new(account: account, started_on: nil)).to_not be_valid
    end

    it 'rejects dates far in the future' do
      expect(described_class.new(account: account, started_on: Date.current + 30)).to_not be_valid
    end

    it 'permits a date within a week of today' do
      expect(described_class.new(account: account, started_on: Date.current + 3)).to be_valid
    end
  end

  describe '.most_recent_for' do
    it 'returns the newest row by started_on' do
      described_class.create!(account: account, started_on: Date.new(2026, 6, 1))
      newest = described_class.create!(account: account, started_on: Date.new(2026, 7, 1))
      expect(described_class.most_recent_for(account)).to eq(newest)
    end
  end
end
