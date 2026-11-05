# frozen_string_literal: true

# When a booked listing can be had (docs/spaces/wachuneed.md, Booking): the
# seller's weekly hours, cut into starts one booking-length apart (an hour
# when there is no set length), and the times they posted, less any time
# already held by a booking waiting or accepted. Hours are read in the
# seller's own time zone; everything comes out in UTC.
#
# A listing with A time but no hours and no posted times takes any time the
# person suggests: `free?` is then true for any time ahead.
class Wachuneed::BookingTimes
  STEP_WITHOUT_LENGTH = 60 # minutes
  MAX_TIMES = 200

  def initialize(listing, now: Time.current)
    @listing = listing
    @booking = listing.booking
    @now     = now
  end

  def suggested?
    Array(@booking['hours']).empty? && Array(@booking['slots']).empty?
  end

  # Free starts from `from` for `days`, earliest first.
  def free(from: @now, days: 14)
    from = [from, @now].max
    until_time = from + days.days
    held = held_times

    candidates(from, until_time).reject { |time| clash?(time, held) }.first(MAX_TIMES)
  end

  def free?(time)
    return false if time.nil? || time <= @now
    return true if suggested?

    candidates(time - 1.minute, time + 1.minute).include?(time) && !clash?(time, held_times)
  end

  private

  def length
    @booking['minutes'].to_i.minutes
  end

  def zone
    ActiveSupport::TimeZone[@booking['time_zone'].to_s] || Time.zone
  end

  def candidates(from, until_time)
    times = posted(from, until_time) + weekly(from, until_time)
    times.select { |time| time > @now && time >= from && time < until_time }.uniq.sort
  end

  def posted(from, until_time)
    Array(@booking['slots']).filter_map do |slot|
      time = Time.zone.parse(slot.to_s)
      time if time && time >= from && time < until_time
    rescue ArgumentError
      nil
    end
  end

  def weekly(from, until_time)
    hours = Array(@booking['hours'])
    return [] if hours.empty?

    step = (@booking['minutes'].presence || STEP_WITHOUT_LENGTH).to_i.minutes
    (from.in_time_zone(zone).to_date..until_time.in_time_zone(zone).to_date).flat_map do |date|
      hours.select { |h| h['day'] == date.wday }.flat_map do |h|
        start  = zone.parse("#{date} #{h['from']}")
        finish = zone.parse("#{date} #{h['to']}")
        starts = []
        time = start
        while time + length <= finish && (length.positive? || time < finish)
          starts << time.utc
          time += step
        end
        starts
      end
    end
  end

  # Starts and ends already held on this listing.
  def held_times
    @listing.listing_offers.held.where.not(starts_at: nil).pluck(:starts_at, :ends_at)
  end

  # A time clashes with a held booking when the two overlap; with no set
  # length, only the same start clashes.
  def clash?(time, held)
    held.any? do |starts_at, ends_at|
      if length.positive?
        time < (ends_at || (starts_at + length)) && starts_at < time + length
      else
        starts_at == time
      end
    end
  end
end
