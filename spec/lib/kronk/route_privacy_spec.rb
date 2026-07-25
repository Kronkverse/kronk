# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::RoutePrivacy do
  # A straight west-east line near Perth; ~944 m between points (0.01°).
  let(:line) { (0..12).map { |i| [115.85 + (i * 0.01), -31.95] } }

  describe '.trim' do
    it 'drops the raw endpoints (usually home) from the stored route' do
      result = described_class.trim(line)

      expect(result[:route].first).to_not eq(line.first)
      expect(result[:route].last).to_not eq(line.last)
      expect(result[:trimmed_m]).to be > 0
    end

    it 'preserves the FULL distance as a stat even though ends are trimmed' do
      result = described_class.trim(line)

      expect(result[:distance_m]).to eq(described_class.length(line).round)
    end

    it 'returns no route for fewer than two points or nil' do
      expect(described_class.trim([[1, 2]])[:route]).to be_nil
      expect(described_class.trim(nil)[:route]).to be_nil
    end

    it 'caps the stored geometry at MAX_POINTS' do
      dense = (0..2000).map { |i| [115.85 + (i * 0.001), -31.95] }

      expect(described_class.trim(dense)[:route].size).to be <= described_class::MAX_POINTS
    end
  end
end
