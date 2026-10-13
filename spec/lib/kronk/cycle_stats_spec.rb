# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/klot.md: the cycle is worked out from the log, never asked for.
RSpec.describe Kronk::CycleStats do
  let(:today) { Date.new(2026, 10, 14) }

  def period(start, finish = nil)
    Struct.new(:started_on, :ended_on).new(Date.iso8601(start), finish && Date.iso8601(finish))
  end

  def stats(*logs, fallback: {})
    described_class.for(logs: logs, today: today, fallback: fallback)
  end

  it 'has nothing to go on with one period, and says so' do
    result = stats(period('2026-10-10'))

    expect(result).to include(cycle_length: 28, cycle_known: false, period_known: false, cycles_logged: 0, next_period: nil)
  end

  it 'knows the cycle length from the second period on' do
    result = stats(period('2026-09-01', '2026-09-05'), period('2026-10-01'))

    expect(result).to include(cycle_length: 30, cycle_known: true, cycles_logged: 1, period_length: 5, period_known: true)
    expect(result[:next_period]).to include(expected_on: Date.new(2026, 10, 31), late_by: 0)
  end

  it 'averages recent cycles and gives the window they varied by' do
    result = stats(period('2026-07-01'), period('2026-07-27'), period('2026-08-26'), period('2026-09-23'))

    expect(result).to include(cycle_length: 28, shortest_cycle: 26, longest_cycle: 30)
    expect(result[:next_period]).to include(from: Date.new(2026, 10, 19), expected_on: Date.new(2026, 10, 21), to: Date.new(2026, 10, 23))
  end

  it 'does not count a gap that is really a missed period' do
    result = stats(period('2026-05-01'), period('2026-08-01'), period('2026-08-29'))

    expect(result).to include(cycle_length: 28, cycles_logged: 1)
  end

  it 'falls back to the lengths typed in before, until there is a log' do
    expect(stats(period('2026-10-10'), fallback: { cycle: 32, period: 4 })).to include(cycle_length: 32, period_length: 4, cycle_known: false)
  end

  it 'says a period is late and leaves the expected day where it was' do
    result = stats(period('2026-08-10'), period('2026-09-07'))

    expect(result[:next_period]).to include(expected_on: Date.new(2026, 10, 5), late_by: 9)
  end

  it 'counts an open period as bleeding, and a closed one only until it ended' do
    expect(stats(period('2026-10-12'))).to include(bleeding: true, current_period_length: 5)
    expect(stats(period('2026-10-07'))).to include(bleeding: true, current_period_length: 8)
    expect(stats(period('2026-10-09', '2026-10-12'))).to include(bleeding: false, current_period_length: 4)
  end
end
