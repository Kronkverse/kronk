# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::GeoCoarsen do
  let(:raw_lat) { -31.97625 }
  let(:raw_lng) { 115.85623 }

  describe '.coarsen' do
    it 'moves the point off the exact coordinate (the raw point is never kept)' do
      result = described_class.coarsen(raw_lat, raw_lng, 'hood', seed: 7)

      expect(result[:lat]).to_not eq(raw_lat)
      expect(result[:lng]).to_not eq(raw_lng)
    end

    it 'is deterministic for the same point + tier + seed' do
      a = described_class.coarsen(raw_lat, raw_lng, 'hood', seed: 7)
      b = described_class.coarsen(raw_lat, raw_lng, 'hood', seed: 7)

      expect(a).to eq(b)
    end

    it 'raises on an unsupported precision tier (exact is deferred)' do
      expect { described_class.coarsen(raw_lat, raw_lng, 'exact', seed: 7) }
        .to raise_error(ArgumentError)
    end
  end

  describe '.radius_for' do
    it 'reports a larger fuzz radius for the coarser tier' do
      expect(described_class.radius_for('city')).to be > described_class.radius_for('hood')
    end
  end

  describe '.distance_m' do
    it 'is ~0 for identical points and positive for distinct ones' do
      expect(described_class.distance_m(0, 0, 0, 0)).to be_within(0.001).of(0)
      expect(described_class.distance_m(-31.95, 115.86, -31.96, 115.87)).to be > 0
    end
  end
end
