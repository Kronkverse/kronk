# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Account::KornerTuneIn do
  let(:account) { Fabricate(:account) }

  describe '#tuned_in_to?' do
    it 'returns true by default (absence = tuned in)' do
      expect(account.tuned_in_to?(:kuestions)).to be true
    end

    it 'returns false after tune_out!' do
      account.tune_out!(:kuestions)
      expect(account.tuned_in_to?(:kuestions)).to be false
    end

    it 'returns true again after tune_in!' do
      account.tune_out!(:kuestions)
      account.tune_in!(:kuestions)
      expect(account.tuned_in_to?(:kuestions)).to be true
    end

    it 'accepts string or symbol slugs interchangeably' do
      account.tune_out!('kuestions')
      expect(account.tuned_in_to?(:kuestions)).to be false
      expect(account.tuned_in_to?('kuestions')).to be false
    end
  end

  describe '#tune_out!' do
    it 'is idempotent — calling twice does not raise or duplicate' do
      account.tune_out!(:kuestions)
      expect { account.tune_out!(:kuestions) }.to_not(change { account.korner_tune_outs.count })
    end
  end

  describe '#tuned_in_korner_slugs' do
    before { Kronk::KornerRegistry.reload! }

    it 'returns every korner that is tuned in by default' do
      slugs = account.tuned_in_korner_slugs
      expect(slugs).to include('kuestions', 'kalendar', 'booth')
    end

    it 'excludes tuned-out korners' do
      account.tune_out!(:kuestions)
      expect(account.tuned_in_korner_slugs).to_not include('kuestions')
    end
  end

  describe 'opt-in korners (feed_projection.tuned_in_by_default: false)' do
    before { Kronk::KornerRegistry.reload! }

    it 'starts a new local account tuned out of Kommons' do
      expect(account.tuned_in_to?(:kommons)).to be false
      expect(account.tuned_in_to?(:kalendar)).to be true
    end

    it 'leaves remote accounts alone' do
      remote = Fabricate(:account, domain: 'example.com')
      expect(remote.korner_tune_outs).to be_empty
    end

    it 'can be tuned in to' do
      account.tune_in!(:kommons)
      expect(account.tuned_in_to?(:kommons)).to be true
    end
  end
end
