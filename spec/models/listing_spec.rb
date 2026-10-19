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

  # docs/spaces/wachuneed.md, Who can see it.
  describe '#messageable_by?' do
    let(:mate)     { Fabricate(:account) }
    let(:orbiter)  { Fabricate(:account) }
    let(:stranger) { Fabricate(:account) }
    let(:listing)  { build(state: 'live').tap(&:save!) }

    def mate!(one, two)
      one.follow!(two)
      two.follow!(one)
    end

    before do
      mate!(account, mate)
      mate!(mate, orbiter)
    end

    it 'is everyone on Kronk by default, never past a block either way' do
      expect(listing.visibility).to eq 'public'
      expect(listing.messageable_by?(stranger)).to be true

      account.block!(stranger)
      expect(listing.messageable_by?(stranger)).to be false
      account.unblock!(stranger)
      stranger.block!(account)
      expect(listing.messageable_by?(stranger)).to be false
    end

    it 'is whoever can see it' do
      listing.update!(visibility: 'mates')
      expect([mate, orbiter, stranger].map { |a| listing.messageable_by?(a) }).to eq [true, false, false]

      listing.update!(visibility: 'orbit')
      expect([mate, orbiter, stranger].map { |a| listing.messageable_by?(a) }).to eq [true, true, false]

      listing.update!(visibility: 'self_only')
      expect([mate, orbiter, stranger].map { |a| listing.messageable_by?(a) }).to eq [false, false, false]
    end

    it 'never offers the poster a chat with themselves' do
      expect(listing.messageable_by?(account)).to be false
      expect(listing.messageable_by?(nil)).to be false
    end

    it "goes by the listing's own reach, whatever its shop's" do
      ListingShop.create!(account: account, name: 'Shop', visibility: 'public')
      listing.update!(visibility: 'mates')

      expect(listing.messageable_by?(stranger)).to be false
      expect(ListingShop.messageable?(account, sender: stranger)).to be true
    end

    it 'refuses a value off the ladder' do
      expect(build(visibility: 'kronkverse')).to_not be_valid
    end
  end

  describe '.clean_variants' do
    it 'makes one variation of two with the same name, keeping what was sent' do
      cleaned = described_class.clean_variants(
        'axes' => [
          { 'name' => 'Colour', 'values' => ['Black'] },
          { 'name' => 'colour ', 'values' => %w(Brown Black) },
        ],
        'items' => [{ 'values' => %w(Black Brown), 'price_cents' => 4500, 'availability' => 'made_to_order' }]
      )

      expect(cleaned['axes']).to eq([{ 'name' => 'Colour', 'values' => %w(Black Brown) }])
      expect(cleaned['items']).to eq([
                                       { 'values' => ['Black'], 'price_cents' => 4500, 'availability' => 'made_to_order' },
                                       { 'values' => ['Brown'], 'price_cents' => 4500, 'availability' => 'made_to_order' },
                                     ])
    end
  end
end
