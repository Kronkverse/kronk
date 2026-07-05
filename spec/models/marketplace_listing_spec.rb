# frozen_string_literal: true

require 'rails_helper'

RSpec.describe MarketplaceListing do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'requires a title' do
      listing = described_class.new(account: account, title: nil, category: 'creation')
      expect(listing).not_to be_valid
      expect(listing.errors[:title]).to be_present
    end

    it 'requires a valid category' do
      listing = described_class.new(account: account, title: 'test', category: 'not_a_thing')
      expect(listing).not_to be_valid
      expect(listing.errors[:category]).to be_present
    end

    it 'accepts every documented category' do
      described_class::CATEGORIES.each do |cat|
        listing = described_class.new(account: account, title: 'test', category: cat)
        expect(listing).to be_valid, "expected #{cat} to be a valid category"
      end
    end

    it 'defaults status to active' do
      listing = described_class.new(account: account, title: 'test', category: 'creation')
      listing.valid?
      expect(listing.status).to eq('active')
    end
  end

  describe 'scopes' do
    let!(:active_creation)  { Fabricate(:account).then { |a| described_class.create!(account: a, title: 'a', category: 'creation') } }
    let!(:paused_creation)  { Fabricate(:account).then { |a| described_class.create!(account: a, title: 'b', category: 'creation', status: 'paused') } }
    let!(:active_service)   { Fabricate(:account).then { |a| described_class.create!(account: a, title: 'c', category: 'service') } }

    it '.active only returns listings with status=active' do
      expect(described_class.active).to contain_exactly(active_creation, active_service)
    end

    it '.in_category filters by category' do
      expect(described_class.in_category('creation')).to contain_exactly(active_creation, paused_creation)
    end

    it '.recent orders by created_at desc' do
      expect(described_class.active.recent.first).to eq(active_service)
    end
  end
end
