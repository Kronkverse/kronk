# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::TuneInCounts do
  before do
    described_class.refresh!
    Kronk::KornerRegistry.reload!
  end

  describe '.compute' do
    it 'counts every local account as tuned in to every korner by default' do
      Fabricate.times(3, :account, domain: nil)

      counts = described_class.compute
      expect(counts['kommons']).to eq(3)
      expect(counts['kalendar']).to eq(3)
    end

    it 'subtracts tune-outs per korner' do
      accounts = Fabricate.times(3, :account, domain: nil)
      accounts.first.tune_out!(:kommons)
      accounts.last.tune_out!(:kommons)

      counts = described_class.compute
      expect(counts['kommons']).to eq(1)
      expect(counts['kalendar']).to eq(3)
    end

    it 'ignores remote accounts' do
      Fabricate.times(2, :account, domain: nil)
      Fabricate(:account, domain: 'example.com')

      expect(described_class.compute['kommons']).to eq(2)
    end
  end

  describe '.for_korner' do
    it 'returns the count for a single korner' do
      Fabricate.times(2, :account, domain: nil)
      expect(described_class.for_korner(:kommons)).to eq(2)
    end

    it 'returns 0 for an unregistered slug' do
      expect(described_class.for_korner(:not_a_korner)).to eq(0)
    end
  end
end
