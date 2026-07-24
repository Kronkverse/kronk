# frozen_string_literal: true

# Kronk::CyclePhase — the phase model from KRONK_TIDES §Phase model.
# Pure function, zero DB access: consumers hand in the cycle length,
# period length and most-recent start date; the module returns
# `day_of_cycle` + `phase`.
#
# Kept isolated as the "one seam" the brief calls for so an Anthemos
# migration later becomes a store swap (change who supplies these
# inputs) rather than a rewrite.
module Kronk
  module CyclePhase
    PHASES = %w(menstrual follicular ovulatory luteal).freeze

    # inputs:
    #   cycle_length      — int (owner setting)
    #   period_length     — int (owner setting)
    #   most_recent_start — Date, or nil if the owner has never logged
    #   today             — Date (defaults to Time.current.to_date; passed
    #                       in for testability)
    #
    # returns:
    #   { day_of_cycle: int|nil, phase: 'menstrual'|'follicular'|'ovulatory'|'luteal'|nil }
    #
    # No log → both fields are nil (brief §Phase model: "everything
    # downstream treats null as 'nothing to show'").
    def self.derive(cycle_length:, period_length:, most_recent_start:, today: Time.current.to_date)
      return { day_of_cycle: nil, phase: nil } if most_recent_start.nil?

      cycle_length  = cycle_length.to_i.positive?  ? cycle_length.to_i  : 28
      period_length = period_length.to_i.positive? ? period_length.to_i : 5

      diff = (today - most_recent_start).to_i
      day_of_cycle = diff.negative? ? 1 : (diff % cycle_length) + 1

      { day_of_cycle: day_of_cycle, phase: phase_for(day_of_cycle, cycle_length, period_length) }
    end

    def self.phase_for(day_of_cycle, cycle_length, period_length)
      ov_day   = [period_length + 3, cycle_length - 14].max
      ov_start = ov_day - 1
      ov_end   = ov_day + 1

      return 'menstrual'  if day_of_cycle <= period_length
      return 'follicular' if day_of_cycle < ov_start
      return 'ovulatory'  if day_of_cycle <= ov_end

      'luteal'
    end
  end
end
