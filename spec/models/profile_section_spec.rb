# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProfileSection do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'requires section_type = drawn' do
      expect(described_class.new(account: account, section_type: 'told', position: 0, settings: { 'render' => 'block' })).to_not be_valid
    end

    it 'requires a render in settings' do
      expect(described_class.new(account: account, section_type: 'drawn', position: 0, settings: {})).to_not be_valid
    end

    it 'requires position >= 0' do
      expect(described_class.new(account: account, section_type: 'drawn', position: -1, settings: { 'render' => 'album', 'korner_slug' => 'albutts' })).to_not be_valid
    end

    it 'accepts a valid drawn shelf' do
      section = described_class.new(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts' })
      expect(section).to be_valid
    end

    it 'rejects an unknown order' do
      section = described_class.new(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts', 'order' => 'random' })
      expect(section).to_not be_valid
    end

    it 'requires order_ids when order is chosen' do
      section = described_class.new(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts', 'order' => 'chosen' })
      expect(section).to_not be_valid
    end

    it 'accepts chosen order with order_ids' do
      section = described_class.new(
        account: account,
        section_type: 'drawn',
        position: 0,
        settings: { 'render' => 'album', 'korner_slug' => 'albutts', 'order' => 'chosen', 'order_ids' => ['1'] }
      )
      expect(section).to be_valid
    end
  end

  describe 'visibility' do
    def build(visibility)
      described_class.create!(account: account, section_type: 'drawn', position: 0,
                              settings: { 'render' => 'album', 'korner_slug' => 'albutts' }, visibility: visibility)
    end

    it 'defaults to public (Kronkverse), same as ProfileCard' do
      section = described_class.create!(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts' })
      expect(section.visibility_public?).to be true
    end

    it 'hides public (Kronkverse) shelves from logged-out viewers' do
      expect(build('public').visible_to?(nil)).to be false
    end

    it 'shows public (Kronkverse) shelves to a signed-in local member' do
      expect(build('public').visible_to?(Fabricate(:account, domain: nil))).to be true
    end

    it 'shows any shelf to the owner regardless of visibility' do
      expect(build('self_only').visible_to?(account)).to be true
    end

    it 'hides self_only shelves from strangers' do
      expect(build('self_only').visible_to?(Fabricate(:account))).to be false
    end

    it 'maps a legacy identity scope onto the ladder' do
      expect(described_class.normalize_visibility('everyone')).to eq('public')
      expect(described_class.normalize_visibility('connections')).to eq('mates')
    end
  end

  describe 'seeding' do
    it 'does not seed a shelf on account creation' do
      account = Fabricate(:account, domain: nil)
      expect(account.profile_sections.count).to eq(0)
    end
  end
end
