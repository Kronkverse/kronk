# frozen_string_literal: true

module Kronk
  # What a log of periods says about a cycle: how long it runs, how long
  # the bleed lasts, and when the next one is due.
  #
  # Nobody is asked for their cycle length. It is the average gap between
  # the starts of logged periods, so it exists from the second period on.
  # Until then a typical length stands in, and `cycle_known` says so.
  module CycleStats
    TYPICAL_CYCLE  = 28
    TYPICAL_PERIOD = 5
    # How many recent cycles the averages look at: bodies drift.
    RECENT = 6
    # A gap outside this is a period nobody logged, not a cycle.
    CYCLE_RANGE = (15..60)
    PERIOD_RANGE = (1..14)

    module_function

    # `logs` — CycleLog-like records (`started_on`, `ended_on`), any order.
    # `fallback` — `{ cycle:, period: }` used while there is too little
    #              logged; the lengths a member typed in before this.
    def for(logs:, today: Time.zone.today, fallback: {})
      sorted  = logs.sort_by(&:started_on)
      cycles  = sorted.each_cons(2).map { |a, b| (b.started_on - a.started_on).to_i }.select { |gap| CYCLE_RANGE.cover?(gap) }
      bleeds  = sorted.filter_map { |log| (log.ended_on - log.started_on).to_i + 1 if log.ended_on }.select { |days| PERIOD_RANGE.cover?(days) }
      latest  = sorted.last

      cycle_length  = average(cycles.last(RECENT)) || fallback[:cycle] || TYPICAL_CYCLE
      period_length = average(bleeds.last(RECENT)) || fallback[:period] || TYPICAL_PERIOD

      {
        cycle_length: cycle_length,
        cycle_known: cycles.any?,
        period_length: period_length,
        period_known: bleeds.any?,
        cycles_logged: cycles.size,
        shortest_cycle: cycles.min,
        longest_cycle: cycles.max,
        bleeding: bleeding?(latest, today),
        # How long this cycle's bleed counts for when the phase is worked
        # out: what was logged, not the average, once there is something.
        current_period_length: current_period_length(latest, period_length, today),
        next_period: next_period(latest, cycles.last(RECENT), cycle_length, today),
      }
    end

    def average(numbers)
      (numbers.sum.to_f / numbers.size).round if numbers.any?
    end

    def bleeding?(latest, today)
      return false if latest.nil? || latest.started_on > today
      return today <= latest.ended_on if latest.ended_on

      (today - latest.started_on).to_i < PERIOD_RANGE.max
    end

    def current_period_length(latest, usual, today)
      return usual if latest.nil?
      return ((latest.ended_on - latest.started_on).to_i + 1).clamp(PERIOD_RANGE.min, PERIOD_RANGE.max) if latest.ended_on

      [usual, (today - latest.started_on).to_i + 1].max.clamp(PERIOD_RANGE.min, PERIOD_RANGE.max)
    end

    # The next start, once there is a cycle to go by: the expected day and
    # the window around it that recent cycles have varied by. A day already
    # behind us means the period is late; it is not moved along.
    def next_period(latest, recent_cycles, cycle_length, today)
      return nil if latest.nil? || recent_cycles.empty?

      expected = latest.started_on + cycle_length
      spread   = ((recent_cycles.max - recent_cycles.min) / 2.0).ceil
      {
        expected_on: expected,
        from: expected - spread,
        to: expected + spread,
        late_by: [(today - expected).to_i, 0].max,
      }
    end
  end
end
