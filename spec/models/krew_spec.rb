# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Krew do
  let(:seeder) { Fabricate(:account) }

  def build(slug: 'test-krew', name: 'Test Krew', access: 'open', **rest)
    described_class.new(slug: slug, name: name, access: access, **rest)
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
      described_class.create!(slug: 'unique', name: 'One', access: 'open')
      expect(described_class.new(slug: 'unique', name: 'Two', access: 'open')).to_not be_valid
    end

    it 'accepts every registered access level' do
      described_class::ACCESS_LEVELS.each do |level|
        krew = build(slug: level.tr('_', '-'), access: level)
        expect(krew).to be_valid, "#{level} should be a valid access level"
      end
    end

    it 'rejects unknown access levels' do
      expect(build(access: 'whatever')).to_not be_valid
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

  describe 'access helpers' do
    it 'reports listed? as the inverse of invite_only' do
      expect(build(access: 'open').listed?).to be true
      expect(build(access: 'requirement_gated').listed?).to be true
      expect(build(access: 'invite_only').listed?).to be false
    end
  end

  describe '#seeder?' do
    let(:krew) { described_class.create!(slug: 'peer', name: 'Peer Krew', access: 'open', seeded_by: seeder) }

    it 'reports the seeded_by account as seeder without a legacy role row' do
      expect(krew.seeder?(seeder)).to be true
    end

    it 'still honours the legacy role=seeder membership' do
      member = Fabricate(:account)
      krew.krew_memberships.create!(account: member, role: 'seeder')
      expect(krew.seeder?(member)).to be true
    end
  end

  describe '#regenerate_invite_token!' do
    let(:krew) { described_class.create!(slug: 'ir', name: 'Invite Regen', access: 'invite_only') }

    it 'rotates the token when called' do
      krew.regenerate_invite_token!
      first = krew.invite_token
      krew.regenerate_invite_token!
      expect(krew.invite_token).to_not eq(first)
    end
  end
end
