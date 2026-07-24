# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::CyclePhase do
  describe '.derive' do
    it 'returns null day + phase when no log exists' do
      out = described_class.derive(cycle_length: 28, period_length: 5, most_recent_start: nil, today: Date.new(2026, 7, 24))
      expect(out).to eq(day_of_cycle: nil, phase: nil)
    end

    it 'returns menstrual on day 1' do
      out = described_class.derive(cycle_length: 28, period_length: 5, most_recent_start: Date.new(2026, 7, 24), today: Date.new(2026, 7, 24))
      expect(out).to eq(day_of_cycle: 1, phase: 'menstrual')
    end

    it 'returns follicular after the period ends' do
      out = described_class.derive(cycle_length: 28, period_length: 5, most_recent_start: Date.new(2026, 7, 24), today: Date.new(2026, 7, 30))
      expect(out).to eq(day_of_cycle: 7, phase: 'follicular')
    end

    it 'returns ovulatory around ov_day (default cycle: day 14)' do
      out = described_class.derive(cycle_length: 28, period_length: 5, most_recent_start: Date.new(2026, 7, 24), today: Date.new(2026, 8, 6))
      expect(out).to eq(day_of_cycle: 14, phase: 'ovulatory')
    end

    it 'returns luteal after ovulation' do
      out = described_class.derive(cycle_length: 28, period_length: 5, most_recent_start: Date.new(2026, 7, 24), today: Date.new(2026, 8, 12))
      expect(out[:day_of_cycle]).to eq(20)
      expect(out[:phase]).to eq('luteal')
    end

    it 'wraps around when today is past cycle_length' do
      # Day 29 with a 28-day cycle → day 1 of a new cycle
      out = described_class.derive(cycle_length: 28, period_length: 5, most_recent_start: Date.new(2026, 7, 24), today: Date.new(2026, 8, 21))
      expect(out[:day_of_cycle]).to eq(1)
      expect(out[:phase]).to eq('menstrual')
    end

    it 'clamps to day 1 when today precedes the most-recent-start' do
      out = described_class.derive(cycle_length: 28, period_length: 5, most_recent_start: Date.new(2026, 7, 24), today: Date.new(2026, 7, 20))
      expect(out).to eq(day_of_cycle: 1, phase: 'menstrual')
    end

    it 'scales the ovulatory window with a non-default cycle length' do
      # cycle=35 → ov_day = max(period_length + 3, 35 - 14) = 21
      out = described_class.derive(cycle_length: 35, period_length: 5, most_recent_start: Date.new(2026, 7, 24), today: Date.new(2026, 8, 13))
      expect(out[:day_of_cycle]).to eq(21)
      expect(out[:phase]).to eq('ovulatory')
    end
  end
end
