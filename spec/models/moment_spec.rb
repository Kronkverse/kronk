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
end
