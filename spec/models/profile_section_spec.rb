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
    it 'defaults to kronk (same as ProfileCard)' do
      section = described_class.create!(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts' })
      expect(section.visibility_kronk?).to be true
    end

    it 'shows everyone-scoped shelves to anonymous viewers' do
      section = described_class.create!(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts' }, visibility: 'everyone')
      expect(section.visible_to?(nil)).to be true
    end

    it 'hides kronk-scoped shelves from anonymous viewers' do
      section = described_class.create!(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts' }, visibility: 'kronk')
      expect(section.visible_to?(nil)).to be false
    end

    it 'shows any shelf to the owner regardless of visibility' do
      section = described_class.create!(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts' }, visibility: 'only_me')
      expect(section.visible_to?(account)).to be true
    end

    it 'hides only_me shelves from strangers' do
      section = described_class.create!(account: account, section_type: 'drawn', position: 0, settings: { 'render' => 'album', 'korner_slug' => 'albutts' }, visibility: 'only_me')
      other = Fabricate(:account)
      expect(section.visible_to?(other)).to be false
    end
  end

  describe 'seeding' do
    it 'does not seed a shelf on account creation' do
      account = Fabricate(:account, domain: nil)
      expect(account.profile_sections.count).to eq(0)
    end
  end
end
