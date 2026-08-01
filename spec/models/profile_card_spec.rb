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
  end

  describe 'default visibility' do
    it 'defaults to kronk (this instance)' do
      card = described_class.create!(account: owner, card_type: 'about', position: 0)
      expect(card.visibility).to eq('kronk')
    end
  end

  describe '#visible_to?' do
    subject { described_class.create!(account: owner, card_type: 'about', position: 0, visibility: visibility) }

    context 'when visibility is everyone' do
      let(:visibility) { :everyone }

      it 'is visible to nil (unauth) viewer' do
        expect(subject.visible_to?(nil)).to be true
      end

      it 'is visible to any account' do
        expect(subject.visible_to?(remote)).to be true
      end
    end

    context 'when visibility is kronk (local)' do
      let(:visibility) { :kronk }

      it 'is not visible to unauth' do
        expect(subject.visible_to?(nil)).to be_falsey
      end

      it 'is visible to a local viewer' do
        expect(subject.visible_to?(viewer)).to be true
      end

      it 'is not visible to a remote viewer' do
        expect(subject.visible_to?(remote)).to be false
      end
    end

    context 'when visibility is connections' do
      let(:visibility) { :connections }

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

    context 'when visibility is vouched (Anthemos placeholder — falls back to connections)' do
      let(:visibility) { :vouched }

      it 'behaves like connections while Anthemos is deferred' do
        Fabricate(:follow, account: viewer, target_account: owner)
        Fabricate(:follow, account: owner, target_account: viewer)
        expect(subject.visible_to?(viewer)).to be true
      end
    end

    context 'when visibility is only_me' do
      let(:visibility) { :only_me }

      it 'is not visible to any other account' do
        expect(subject.visible_to?(viewer)).to be false
      end

      it 'is visible to the owner' do
        expect(subject.visible_to?(owner)).to be true
      end
    end

    it 'always shows to the owner regardless of visibility' do
      %i(everyone kronk connections vouched only_me).each do |v|
        card = described_class.create!(account: owner, card_type: 'about', position: 0, visibility: v)
        expect(card.visible_to?(owner)).to be(true), "#{v} should be visible to owner"
        card.destroy!
      end
    end
  end
end
