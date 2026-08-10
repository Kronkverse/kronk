# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Moment do
  let(:account) { Fabricate(:account) }
  let(:photo)   { Fabricate(:media_attachment, account: account) }
  let(:voice)   { Fabricate(:media_attachment, account: account) }

  describe 'media / voice presence' do
    it 'is valid with a photo and no voice' do
      moment = described_class.new(account: account, media_attachment: photo, visibility: :public)
      expect(moment).to be_valid
    end

    it 'is valid with a voice clip and no photo (voice-only Moment)' do
      moment = described_class.new(account: account, voice_media_attachment: voice, visibility: :public)
      expect(moment).to be_valid
    end

    it 'is valid with both a photo and a voice clip' do
      moment = described_class.new(account: account, media_attachment: photo, voice_media_attachment: voice, visibility: :public)
      expect(moment).to be_valid
    end

    it 'is invalid with neither a photo nor a voice clip' do
      moment = described_class.new(account: account, visibility: :public)

      expect(moment).to_not be_valid
      expect(moment.errors[:base]).to include('must have a photo, video, or voice clip')
    end
  end

  describe 'krew as an orthogonal audience axis' do
    let(:krew)     { Krew.create!(slug: 'squad', name: 'Squad', access: 'open') }
    let(:member)   { Fabricate(:account) }
    let(:stranger) { Fabricate(:account) }

    before { krew.krew_memberships.create!(account: member) }

    it 'is no longer a visibility value' do
      expect(described_class.visibilities).to_not have_key('krew')
    end

    it 'is valid as a self_only Moment carrying a krew (owner + krew audience)' do
      moment = described_class.new(account: account, media_attachment: photo, visibility: :self_only, krew: krew)
      expect(moment).to be_valid
    end

    it 'shows a self_only + krew Moment to a member of that krew (additive)' do
      moment = described_class.create!(account: account, media_attachment: photo, visibility: :self_only, krew: krew)
      expect(moment.visible_to?(member)).to be true
    end

    it 'hides a self_only + krew Moment from a non-member' do
      moment = described_class.create!(account: account, media_attachment: photo, visibility: :self_only, krew: krew)
      expect(moment.visible_to?(stranger)).to be false
    end

    it 'shows a mates Moment to a krew member who is not a mate (additive)' do
      moment = described_class.create!(account: account, media_attachment: photo, visibility: :mates, krew: krew)
      expect(moment.visible_to?(member)).to be true
    end

    it 'includes krew-targeted Moments in the visible_to scope regardless of reach' do
      moment = described_class.create!(account: account, media_attachment: photo, visibility: :self_only, krew: krew)
      expect(described_class.visible_to(member)).to include(moment)
    end
  end
end
