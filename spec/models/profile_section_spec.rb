# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProfileSection do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'requires a valid section_type' do
      expect(described_class.new(account: account, section_type: 'wat', position: 0)).to_not be_valid
    end

    it 'accepts every valid section_type' do
      described_class::SECTION_TYPES.each do |t|
        section = described_class.new(account: account, section_type: t, position: 0)
        section.settings = { 'korner_slug' => 'kommons' } if t == 'korner'
        section.settings = { 'tag_name' => 'music' } if t == 'kategory'
        section.settings = { 'body' => 'Hello, world.' } if t == 'text'
        expect(section).to be_valid, "#{t} should be a valid type"
      end
    end

    it 'requires position >= 0' do
      expect(described_class.new(account: account, section_type: 'timeline', position: -1)).to_not be_valid
    end

    it 'requires korner_slug for korner sections' do
      section = described_class.new(account: account, section_type: 'korner', position: 0, settings: {})
      expect(section).to_not be_valid
    end

    it 'requires tag_name for kategory sections' do
      section = described_class.new(account: account, section_type: 'kategory', position: 0, settings: {})
      expect(section).to_not be_valid
    end

    it 'requires body for text sections' do
      section = described_class.new(account: account, section_type: 'text', position: 0, settings: {})
      expect(section).to_not be_valid
    end

    it 'rejects a text body longer than the cap' do
      section = described_class.new(
        account: account,
        section_type: 'text',
        position: 0,
        settings: { 'body' => 'x' * (described_class::TEXT_BODY_MAX + 1) }
      )
      expect(section).to_not be_valid
    end
  end

  describe 'auto-seeding on account creation' do
    it 'creates one timeline section on a fresh local account' do
      account = Fabricate(:account, domain: nil)
      expect(account.profile_sections.count).to eq(1)
      expect(account.profile_sections.first.section_type).to eq('timeline')
    end

    it 'does not seed sections on remote accounts' do
      remote = Fabricate(:account, domain: 'example.com')
      expect(remote.profile_sections.count).to eq(0)
    end
  end
end
