# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/wachuneed.md, Brands.
RSpec.describe WachuneedBrand do
  let(:proposer) { Fabricate(:account) }

  def build(**overrides)
    described_class.new(
      account: proposer,
      name: 'Zorali',
      url: 'https://zorali.example',
      why: 'Outdoor gear made to last, and they repair it.',
      **overrides
    )
  end

  describe 'validations' do
    it 'is valid with a name, a web address and a reason' do
      expect(build).to be_valid
    end

    it 'needs a reason' do
      expect(build(why: '  ')).to_not be_valid
    end

    it 'needs a name' do
      expect(build(name: '')).to_not be_valid
    end

    it 'takes http and https addresses' do
      expect(build(url: 'http://zorali.example/about')).to be_valid
      expect(build(url: ' https://zorali.example ')).to be_valid
    end

    it 'refuses anything that is not a web address' do
      ['javascript:alert(1)', 'ftp://zorali.example', 'zorali.example', 'https://', 'not a url at all'].each do |url|
        expect(build(url: url)).to_not be_valid, url
      end
    end

    it 'accepts each category, or none' do
      described_class::CATEGORIES.each { |category| expect(build(category: category)).to be_valid, category }
      expect(build(category: nil)).to be_valid
      expect(build(category: '')).to be_valid
    end

    it 'refuses a category not on the list' do
      expect(build(category: 'weapons')).to_not be_valid
    end

    it 'keeps one brand per name, whatever the case' do
      build.save!

      expect(build(name: 'ZORALI ')).to_not be_valid
    end
  end

  describe 'backing' do
    let(:brand) { build.tap(&:save!) }
    let(:backers) { Fabricate.times(2, :account) }

    it 'is backed by its proposer from the start' do
      expect(brand.backers).to contain_exactly(proposer)
      expect(brand).to_not be_listed
    end

    it 'counts one backing per member' do
      2.times { brand.back!(backers.first) }

      expect(brand.backers_count).to eq 2
    end

    it 'is listed once it has the backers it needs' do
      backers.each { |backer| brand.back!(backer) }

      expect(brand.backers_count).to eq described_class::BACKERS_TO_LIST
      expect(brand).to be_listed
      expect(described_class.listed).to include(brand)
      expect(described_class.proposed).to_not include(brand)
      expect(brand.reload.listed_at).to be_present
    end

    it 'nudges the proposer once, the first time it is listed' do
      allow(Kronk::KornerEvents).to receive(:publish)

      backers.each { |backer| brand.back!(backer) }
      brand.unback!(backers.last)
      brand.back!(backers.last)

      expect(Kronk::KornerEvents).to have_received(:publish)
        .with('wachuneed.brand.listed', actor_account_id: backers.last.id, recipient_account_id: proposer.id, brand_id: brand.id)
        .once
    end

    it 'goes back to Proposed when a backer takes their backing back' do
      backers.each { |backer| brand.back!(backer) }
      brand.unback!(backers.first)

      expect(brand).to_not be_listed
      expect(described_class.proposed).to include(brand)
    end

    it 'does not let the proposer take their backing back' do
      expect { brand.unback!(proposer) }.to raise_error(Mastodon::ValidationError)
      expect(brand.backed_by?(proposer)).to be true
    end
  end
end
