# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProfileCard do
  let(:owner)   { Fabricate(:account, domain: nil) }
  let(:viewer)  { Fabricate(:account, domain: nil) }
  let(:remote)  { Fabricate(:account, domain: 'example.com') }

  describe 'validations' do
    it 'requires a known card_type' do
      expect(described_class.new(account: owner, card_type: 'wat', position: 0)).to_not be_valid
    end

    it 'accepts every known card_type' do
      described_class::CARD_TYPES.each do |t|
        card = described_class.new(account: owner, card_type: t, position: 0)
        expect(card).to be_valid, "#{t} should be a valid card_type"
      end
    end

    it 'is unique per account+card_type' do
      described_class.create!(account: owner, card_type: 'about', position: 0)
      dupe = described_class.new(account: owner, card_type: 'about', position: 1)
      expect(dupe).to_not be_valid
    end

    it 'requires position >= 0' do
      expect(described_class.new(account: owner, card_type: 'about', position: -1)).to_not be_valid
    end

    it 'caps body length' do
      long = 'a' * 4001
      expect(described_class.new(account: owner, card_type: 'about', position: 0, body: long)).to_not be_valid
    end

    it 'defaults to the block render' do
      card = described_class.create!(account: owner, card_type: 'about', position: 0)
      expect(card.render).to eq('block')
    end

    it 'accepts every declared render shape' do
      described_class::RENDER_SHAPES.each_with_index do |shape, i|
        card = described_class.new(account: owner, card_type: described_class::CARD_TYPES[i], position: i, render: shape)
        expect(card).to be_valid, "#{shape} should be a valid render"
      end
    end

    it 'rejects an unknown render shape' do
      card = described_class.new(account: owner, card_type: 'about', position: 0, render: 'holograph')
      expect(card).to_not be_valid
    end
  end

  describe 'default visibility' do
    it 'defaults to public (Kronkverse)' do
      card = described_class.create!(account: owner, card_type: 'about', position: 0)
      expect(card.visibility).to eq('public')
    end
  end

  describe '#visible_to?' do
    subject { described_class.create!(account: owner, card_type: 'about', position: 0, visibility: visibility) }

    context 'when visibility is public (Kronkverse)' do
      let(:visibility) { :public }

      it 'is not visible to a logged-out (nil) viewer' do
        expect(subject).to_not be_visible_to(nil)
      end

      it 'is visible to a signed-in local member' do
        expect(subject.visible_to?(viewer)).to be true
      end

      it 'is not visible to a remote viewer' do
        expect(subject.visible_to?(remote)).to be false
      end
    end

    context 'when visibility is mates' do
      let(:visibility) { :mates }

      it 'is not visible without a follow' do
        expect(subject.visible_to?(viewer)).to be false
      end

      it 'is not visible with a one-way follow' do
        Fabricate(:follow, account: viewer, target_account: owner)
        expect(subject.visible_to?(viewer)).to be false
      end

      it 'is visible with mutual follows' do
        Fabricate(:follow, account: viewer, target_account: owner)
        Fabricate(:follow, account: owner, target_account: viewer)
        expect(subject.visible_to?(viewer)).to be true
      end
    end

    context 'when visibility is orbit' do
      let(:visibility) { :orbit }

      it 'is visible to a direct mate' do
        Fabricate(:follow, account: viewer, target_account: owner)
        Fabricate(:follow, account: owner, target_account: viewer)
        expect(subject.visible_to?(viewer)).to be true
      end

      it 'is visible to a mate-of-a-mate' do
        mate = Fabricate(:account, domain: nil)
        Fabricate(:follow, account: owner, target_account: mate)
        Fabricate(:follow, account: mate, target_account: owner)
        Fabricate(:follow, account: mate, target_account: viewer)
        Fabricate(:follow, account: viewer, target_account: mate)
        expect(subject.visible_to?(viewer)).to be true
      end

      it 'is not visible to an unrelated account' do
        expect(subject.visible_to?(viewer)).to be false
      end
    end

    context 'when visibility is self_only' do
      let(:visibility) { :self_only }

      it 'is not visible to any other account' do
        expect(subject.visible_to?(viewer)).to be false
      end

      it 'is visible to the owner' do
        expect(subject.visible_to?(owner)).to be true
      end
    end

    it 'always shows to the owner regardless of visibility' do
      %i(public mates orbit self_only).each do |v|
        card = described_class.create!(account: owner, card_type: 'about', position: 0, visibility: v)
        expect(card.visible_to?(owner)).to be(true), "#{v} should be visible to owner"
        card.destroy!
      end
    end
  end

  describe '.normalize_visibility' do
    it 'maps legacy identity scopes onto the reach ladder' do
      expect(described_class.normalize_visibility('everyone')).to eq('public')
      expect(described_class.normalize_visibility('kronk')).to eq('public')
      expect(described_class.normalize_visibility('connections')).to eq('mates')
      expect(described_class.normalize_visibility('vouched')).to eq('mates')
      expect(described_class.normalize_visibility('only_me')).to eq('self_only')
    end

    it 'passes a reach-ladder value through unchanged' do
      expect(described_class.normalize_visibility('orbit')).to eq('orbit')
    end
  end
end
