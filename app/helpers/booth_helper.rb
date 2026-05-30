# frozen_string_literal: true

module BoothHelper
  def format_duration(seconds)
    return '—' if seconds.nil?

    total = seconds.to_i
    hours = total / 3600
    mins  = (total % 3600) / 60
    secs  = total % 60

    if hours > 0
      "#{hours}:#{mins.to_s.rjust(2, '0')}:#{secs.to_s.rjust(2, '0')}"
    else
      "#{mins}:#{secs.to_s.rjust(2, '0')}"
    end
  end
end
