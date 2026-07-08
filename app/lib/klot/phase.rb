# frozen_string_literal: true

# Cycle-phase math for Klot. Mirrors the prototype's `ranges(L,P)` +
# `phaseOf(day,L,P)` — kept on the backend so the projection served to
# viewers is authoritative (they never receive the raw log, so they
# can't compute it themselves).
module Klot
  module Phase
    KEYS = %w(menstrual follicular ovulatory luteal).freeze

    module_function

    # Compute the phase for `account` on `on` (defaults to today). Returns
    # nil when the account has no logged periods.
    def for(account, on: Date.today)
      last = account.klot_periods.most_recent_first.limit(1).first
      return nil if last.nil?

      settings = KlotSetting.for(account)
      day = day_of_cycle(last.started_on, on, settings.cycle_length)
      resolve(day, settings.cycle_length, settings.period_length)
    end

    def day_of_cycle(last_start, on, cycle_length)
      diff = (on - last_start).to_i
      return 1 if diff.negative?

      (diff % cycle_length) + 1
    end

    # Given day-in-cycle, cycle length L, and period length P, return the
    # phase key. Ovulation is placed at `max(P+3, L-14)` — the classic
    # luteal-anchored approximation used by the prototype.
    def resolve(day, cycle_length, period_length)
      ranges(cycle_length, period_length).each do |(key, from, to)|
        return key if day >= from && day <= to
      end
      'luteal'
    end

    def ranges(cycle_length, period_length)
      ov = [period_length + 3, cycle_length - 14].max
      a  = ov - 1
      b  = ov + 1
      [
        ['menstrual',   1,       period_length],
        ['follicular',  period_length + 1, a - 1],
        ['ovulatory',   a,       b],
        ['luteal',      b + 1,   cycle_length],
      ]
    end
  end
end
