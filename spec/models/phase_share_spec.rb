# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PhaseShare do
  let(:sharer) { Fabricate(:account) }
  let(:viewer) { Fabricate(:account) }

  describe 'validations' do
    it 'rejects self-sharing' do
      row = described_class.new(sharer_id: sharer.id, viewer_id: sharer.id)
      expect(row).to_not be_valid
    end

    it 'rejects duplicates on (sharer, viewer)' do
      described_class.create!(sharer: sharer, viewer: viewer)
      expect(described_class.new(sharer: sharer, viewer: viewer)).to_not be_valid
    end
  end

  describe '.grant!' do
    it 'creates a grant idempotently' do
      first  = described_class.grant!(sharer: sharer, viewer: viewer)
      second = described_class.grant!(sharer: sharer, viewer: viewer)
      expect(first.id).to eq(second.id)
    end

    it 'is a no-op when sharer and viewer are the same account' do
      expect { described_class.grant!(sharer: sharer, viewer: sharer) }.to_not change(described_class, :count)
    end
  end

  describe 'scopes' do
    it 'partitions rows by direction' do
      other = Fabricate(:account)
      described_class.create!(sharer: sharer, viewer: viewer)
      described_class.create!(sharer: other,  viewer: sharer)

      expect(described_class.outbound_from(sharer).map(&:viewer_id)).to eq([viewer.id])
      expect(described_class.inbound_to(sharer).map(&:sharer_id)).to eq([other.id])
    end
  end
end
