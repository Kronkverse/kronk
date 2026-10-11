# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::TuneInGate do
  let(:account) { Fabricate(:account) }

  before { Kronk::KornerRegistry.reload! }

  describe '.filter with the feature flag OFF (default)' do
    it 'returns statuses unchanged' do
      statuses = Object.new # opaque sentinel — filter() returns it unchanged when the flag is off
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

    it 'drops a proposal, and a boost of one, for an account tuned out of Kommons' do
      account.tune_out!(:kommons)
      proposal = Fabricate(:status, post_type: :proposal)
      boost = Fabricate(:status, reblog: proposal)
      plain = Fabricate(:status)

      expect(described_class.filter(account, [proposal, boost, plain])).to eq([plain])
    end

    it 'keeps proposals for an account tuned in to Kommons' do
      account.tune_in!(:kommons)
      proposal = Fabricate(:status, post_type: :proposal)

      expect(described_class.filter(account, [proposal])).to eq([proposal])
    end

    it 'drops a korner card matched by association (Albutts)' do
      account.tune_in!(:kommons)
      account.tune_out!(:albutts)
      album_status = Fabricate(:status)
      Album.create!(owner: album_status.account, status: album_status, title: 'Trip')
      plain = Fabricate(:status)

      expect(described_class.filter(account, [album_status.reload, plain])).to eq([plain])
    end

    it 'returns statuses unchanged when account is nil' do
      status = Fabricate(:status)
      expect(described_class.filter(nil, [status])).to eq([status])
    end
  end
end
