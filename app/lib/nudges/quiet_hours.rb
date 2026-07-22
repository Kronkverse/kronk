# frozen_string_literal: true

# Reads the Nudges korner's per-user `quiet_hours_start` /
# `quiet_hours_end` settings and answers "is this user in a quiet
# window right now?"
#
# Wiring point for the future push subsystem — brief §Non-negotiables:
# "Quiet hours hold delivery in-window; per-type push toggles are
# respected." Kronk doesn't emit push for Nudges events yet (Notification-
# based push targets the notification drawer, which Nudges replaced), so
# nothing calls this helper today. Landed ahead of that consumer so the
# push worker can just `next if silent_for?(user)` when it arrives.
#
# Manifest defaults come from `config/korners/nudges.yaml`:
#   quiet_hours_start: '22:00'
#   quiet_hours_end:   '07:00'
#
# Windows wrap over midnight (start > end) — that's the common case.
module Nudges
  module QuietHours
    module_function

    KORNER_SLUG = 'nudges'
    DEFAULT_START = '22:00'
    DEFAULT_END   = '07:00'

    # @param user [User]
    # @param now [Time] override for tests; defaults to the user's local now
    # @return [Boolean]
    def silent_for?(user, now: nil)
      return false unless user

      now ||= current_time_in_user_zone(user)
      start_min = to_minutes(read_setting(user, 'quiet_hours_start') || DEFAULT_START)
      end_min   = to_minutes(read_setting(user, 'quiet_hours_end') || DEFAULT_END)
      return false if start_min == end_min # zero-width window disables

      minute_of_day = (now.hour * 60) + now.min
      in_window?(minute_of_day, start_min, end_min)
    end

    def current_time_in_user_zone(user)
      zone = user.time_zone.presence
      zone ? Time.current.in_time_zone(zone) : Time.current
    end

    def read_setting(user, key)
      row = UserKornerSetting.find_by(user_id: user.id, korner_slug: KORNER_SLUG)
      row&.values&.dig(key)
    end

    # `HH:MM` → integer minutes-of-day. Nil / malformed → returns nil
    # so the caller can fall back to defaults.
    def to_minutes(value)
      return nil unless value.is_a?(String) && value.match?(/\A\d{1,2}:\d{2}\z/)

      h, m = value.split(':').map(&:to_i)
      return nil unless h.between?(0, 23) && m.between?(0, 59)

      (h * 60) + m
    end

    # Wrap-around aware. Start=22:00, End=07:00 → 22:00-07:00 next day
    # is quiet; Start=07:00, End=22:00 → 07:00-22:00 is quiet (day
    # window).
    def in_window?(minute, start_min, end_min)
      if start_min < end_min
        minute >= start_min && minute < end_min
      else
        minute >= start_min || minute < end_min
      end
    end
  end
end
