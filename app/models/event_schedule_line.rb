# frozen_string_literal: true

# One line of an event's schedule (docs/spaces/kalendar.md, Schedule): a
# day, a start (and maybe an end) on the event's own clock, and what
# happens. An event has one schedule, these lines; a projekt the event is
# Konnected to edits the same lines, never a copy (Tal, 2026-11-18).
class EventScheduleLine < ApplicationRecord
  MAX_PER_EVENT = 200
  MINUTES_IN_DAY = 24 * 60

  belongs_to :event
  belongs_to :created_by_account, class_name: 'Account', optional: true

  validates :day, presence: true
  validates :title, presence: true, length: { maximum: 100 }
  validates :note, length: { maximum: 280 }
  validates :start_minute, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than: MINUTES_IN_DAY }
  validates :end_minute, numericality: { only_integer: true, greater_than: :start_minute, less_than_or_equal_to: MINUTES_IN_DAY }, allow_nil: true
  validate :room_on_the_schedule, on: :create

  scope :in_order, -> { order(:day, :start_minute, :id) }

  # "HH:MM" from minutes after midnight, and back. 24:00 is a valid end.
  def self.clock(minutes)
    return if minutes.nil?

    format('%<h>02d:%<m>02d', h: minutes / 60, m: minutes % 60)
  end

  def self.minutes(clock)
    match = /\A(\d{1,2}):(\d{2})\z/.match(clock.to_s.strip)
    return if match.nil?

    (match[1].to_i * 60) + match[2].to_i
  end

  private

  def room_on_the_schedule
    errors.add(:base, :too_many) if event && event.schedule_lines.count >= MAX_PER_EVENT
  end
end
