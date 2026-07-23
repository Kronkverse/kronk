# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Krew do
  let(:seeder) { Fabricate(:account) }

  def build(slug: 'test-krew', name: 'Test Krew', **rest)
    described_class.new(slug: slug, name: name, **rest)
  end

  describe 'validations' do
    it 'requires a slug' do
      expect(build(slug: nil)).to_not be_valid
    end

    it 'requires a name' do
      expect(build(name: nil)).to_not be_valid
    end

    it 'rejects slugs with uppercase or spaces' do
      expect(build(slug: 'Test Krew')).to_not be_valid
      expect(build(slug: 'test krew')).to_not be_valid
    end

    it 'accepts slugs with lowercase and hyphens' do
      expect(build(slug: 'test-krew')).to be_valid
    end

    it 'enforces slug uniqueness' do
      described_class.create!(slug: 'unique', name: 'One')
      expect(described_class.new(slug: 'unique', name: 'Two')).to_not be_valid
    end

    it 'accepts every registered governance framework' do
      described_class::GOVERNANCE_FRAMEWORKS.each do |framework|
        krew = build(slug: framework, governance_framework: framework, governance_threshold: 2)
        expect(krew).to be_valid, "#{framework} should be a valid framework"
      end
    end

    it 'rejects threshold governance without a threshold value' do
      expect(build(governance_framework: 'threshold', governance_threshold: nil)).to_not be_valid
    end
  end

  describe '#seeder? and #member?' do
    let(:krew) { described_class.create!(slug: 'peer', name: 'Peer Krew') }

    it 'reports seeder for a seeder membership' do
      krew.krew_memberships.create!(account: seeder, role: 'seeder')
      expect(krew.seeder?(seeder)).to be true
    end

    it 'reports member for any membership' do
      member = Fabricate(:account)
      krew.krew_memberships.create!(account: member, role: 'member')
      expect(krew.member?(member)).to be true
      expect(krew.seeder?(member)).to be false
    end
  end
end
