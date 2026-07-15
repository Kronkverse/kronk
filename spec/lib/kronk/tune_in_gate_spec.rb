# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::TuneInGate do
  let(:account) { Fabricate(:account) }

  before { Kronk::KornerRegistry.reload! }

  describe '.filter with the feature flag OFF (default)' do
    it 'returns statuses unchanged' do
      statuses = double('statuses')
      expect(described_class.filter(account, statuses)).to be(statuses)
    end
  end

  describe '.filter with the feature flag ON' do
    around do |example|
      Kronk::FeatureFlags.with_flag(tune_in_enforced: true) { example.run }
    end

    it 'returns statuses unchanged when the account has no tune-outs' do
      status = Fabricate(:status)
      expect(described_class.filter(account, [status])).to eq([status])
    end

    it 'passes plain toots (no korner projection) through even when the account has tune-outs' do
      account.tune_out!(:kommons)
      status = Fabricate(:status) # post_type: normal, no proposal
      expect(described_class.filter(account, [status])).to eq([status])
    end

    it 'returns statuses unchanged when account is nil' do
      status = Fabricate(:status)
      expect(described_class.filter(nil, [status])).to eq([status])
    end
  end
end
