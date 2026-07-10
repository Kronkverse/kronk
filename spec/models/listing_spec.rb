# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Listing do
  let(:account) { Fabricate(:account) }

  def build(**overrides)
    described_class.new(
      account: account,
      title: 'Handmade ceramic mug',
      description: 'Fired last week.',
      category: 'creation',
      **overrides
    )
  end

  describe 'validations' do
    it 'requires a title' do
      expect(build(title: nil)).to_not be_valid
    end

    it 'accepts each valid category' do
      described_class::CATEGORIES.each { |c| expect(build(category: c)).to be_valid, c }
    end

    it 'rejects unknown categories' do
      expect(build(category: 'weapons')).to_not be_valid
    end

    it 'rejects negative price_cents' do
      expect(build(price_cents: -100, price_currency: 'AUD')).to_not be_valid
    end

    it 'accepts nil price (free / by-arrangement)' do
      expect(build(price_cents: nil)).to be_valid
    end

    it 'requires 3-char currency when currency is set' do
      expect(build(price_currency: 'AU')).to_not be_valid
    end
  end

  describe 'state machine' do
    it '#close! flips state to closed and sets closed_at' do
      listing = build(state: 'live')
      listing.save!
      listing.close!
      expect(listing.reload.state).to eq('closed')
      expect(listing.closed_at).to be_present
    end
  end

  describe 'offer accept' do
    it 'accepting an offer moves the listing to reserved' do
      listing = build(state: 'live')
      listing.save!
      offer = ListingOffer.create!(listing: listing, offerer: Fabricate(:account), message: 'hi')

      offer.accept!

      expect(offer.reload.state).to eq('accepted')
      expect(listing.reload.state).to eq('reserved')
    end
  end
end
