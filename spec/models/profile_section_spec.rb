# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProfileSection do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'requires a valid section_type' do
      expect(described_class.new(account: account, section_type: 'wat', position: 0, settings: { 'render' => 'block' })).to_not be_valid
    end

    it 'requires a render in settings' do
      expect(described_class.new(account: account, section_type: 'told', position: 0, settings: {})).to_not be_valid
    end

    it 'requires position >= 0' do
      expect(described_class.new(account: account, section_type: 'told', position: -1, settings: { 'render' => 'block', 'body' => 'hi' })).to_not be_valid
    end
  end

  describe 'told/block shape' do
    it 'requires a body' do
      section = described_class.new(account: account, section_type: 'told', position: 0, settings: { 'render' => 'block' })
      expect(section).to_not be_valid
    end

    it 'rejects a body over the cap' do
      section = described_class.new(
        account: account,
        section_type: 'told',
        position: 0,
        settings: { 'render' => 'block', 'body' => 'x' * (described_class::TEXT_BODY_MAX + 1) }
      )
      expect(section).to_not be_valid
    end

    it 'accepts a valid block shelf' do
      section = described_class.new(account: account, section_type: 'told', position: 0, settings: { 'render' => 'block', 'body' => 'Hello.' })
      expect(section).to be_valid
    end
  end

  describe 'told/chips + rail shapes' do
    it 'requires items for chips' do
      section = described_class.new(account: account, section_type: 'told', position: 0, settings: { 'render' => 'chips' })
      expect(section).to_not be_valid
    end

    it 'requires cards for rail' do
      section = described_class.new(account: account, section_type: 'told', position: 0, settings: { 'render' => 'rail' })
      expect(section).to_not be_valid
    end
  end

  describe 'drawn shape' do
    it 'accepts a drawn shelf bound to a korner slug' do
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
    it 'defaults to public' do
      section = described_class.new(account: account, section_type: 'told', position: 0, settings: { 'render' => 'block', 'body' => 'hi' })
      expect(section.public_scope?).to be true
    end

    it 'is visible to the owner regardless of visibility' do
      section = described_class.create!(account: account, section_type: 'told', position: 0, settings: { 'render' => 'block', 'body' => 'hi' }, visibility: 'self_only')
      expect(section.visible_to?(account)).to be true
    end

    it 'hides self_only shelves from strangers' do
      section = described_class.create!(account: account, section_type: 'told', position: 0, settings: { 'render' => 'block', 'body' => 'hi' }, visibility: 'self_only')
      other = Fabricate(:account)
      expect(section.visible_to?(other)).to be false
    end

    it 'shows public shelves to anonymous viewers' do
      section = described_class.create!(account: account, section_type: 'told', position: 0, settings: { 'render' => 'block', 'body' => 'hi' })
      expect(section.visible_to?(nil)).to be true
    end
  end

  describe 'seeding' do
    it 'does not seed a shelf on account creation' do
      account = Fabricate(:account, domain: nil)
      expect(account.profile_sections.count).to eq(0)
    end
  end
end
