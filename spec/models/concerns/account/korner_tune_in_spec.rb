# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Account::KornerTuneIn do
  let(:account) { Fabricate(:account) }

  describe '#tuned_in_to?' do
    it 'returns true by default (absence = tuned in)' do
      expect(account.tuned_in_to?(:kommons)).to be true
    end

    it 'returns false after tune_out!' do
      account.tune_out!(:kommons)
      expect(account.tuned_in_to?(:kommons)).to be false
    end

    it 'returns true again after tune_in!' do
      account.tune_out!(:kommons)
      account.tune_in!(:kommons)
      expect(account.tuned_in_to?(:kommons)).to be true
    end

    it 'accepts string or symbol slugs interchangeably' do
      account.tune_out!('kommons')
      expect(account.tuned_in_to?(:kommons)).to be false
      expect(account.tuned_in_to?('kommons')).to be false
    end
  end

  describe '#tune_out!' do
    it 'is idempotent — calling twice does not raise or duplicate' do
      account.tune_out!(:kommons)
      expect { account.tune_out!(:kommons) }.to_not(change { account.korner_tune_outs.count })
    end
  end

  describe '#tuned_in_korner_slugs' do
    before { Kronk::KornerRegistry.reload! }

    it 'returns every registered slug when no tune-outs exist' do
      slugs = account.tuned_in_korner_slugs
      expect(slugs).to include('kommons', 'kuestions', 'kalendar', 'booth')
    end

    it 'excludes tuned-out korners' do
      account.tune_out!(:kommons)
      expect(account.tuned_in_korner_slugs).to_not include('kommons')
    end
  end
end
