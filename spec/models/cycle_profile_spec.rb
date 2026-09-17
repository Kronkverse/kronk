# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CycleProfile do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'accepts defaults' do
      expect(described_class.new(account: account, cycle_length: 28, period_length: 5)).to be_valid
    end

    it 'rejects a cycle_length outside the clamps' do
      expect(described_class.new(account: account, cycle_length: 5, period_length: 3)).to_not be_valid
      expect(described_class.new(account: account, cycle_length: 200, period_length: 3)).to_not be_valid
    end

    it 'rejects a period_length longer than the cycle' do
      expect(described_class.new(account: account, cycle_length: 20, period_length: 21)).to_not be_valid
    end
  end

  describe '.for!' do
    it 'creates a profile on first call and finds it thereafter' do
      first  = described_class.for!(account)
      second = described_class.for!(account)
      expect(first.id).to eq(second.id)
    end
  end
end
