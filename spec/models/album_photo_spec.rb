# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AlbumPhoto do
  describe '.newest_bursts_first' do
    it 'puts later bursts first and keeps each burst in the order it was added' do
      ann = Fabricate(:account)
      bo = Fabricate(:account)
      at = Time.zone.parse('2026-10-01 10:00')
      photo = ->(who, mins) { described_class.new(contributor: who, created_at: at + mins.minutes) }
      made = [photo.call(ann, 0), photo.call(ann, 1), photo.call(ann, 2)]
      later = [photo.call(bo, 60), photo.call(bo, 61)]
      last = [photo.call(ann, 62)]

      expect(described_class.newest_bursts_first(made + later + last)).to eq(last + later + made)
    end
  end
end
