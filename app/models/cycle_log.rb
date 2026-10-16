# frozen_string_literal: true

# CycleLog — one period (a bleed): the day it started and, once the owner
# says so, the day it ended. Ordered `started_on desc`; the newest row
# anchors the phase calculation, and the gaps between starts are what the
# cycle length is worked out from (Kronk::CycleStats). Hard-delete on
# removal (docs/spaces/klot.md — "logs hard-delete, nothing is
# retained").
class CycleLog < ApplicationRecord
  # A bleed longer than this is almost always a forgotten "it ended".
  MAX_LENGTH = 21

  belongs_to :account

  validates :started_on, presence: true
  validate  :not_in_the_far_future
  validate  :ends_after_it_starts
  validate  :apart_from_other_periods

  scope :newest_first, -> { order(started_on: :desc) }

  # Anchors the phase calculation for an account.
  def self.most_recent_for(account)
    where(account: account).newest_first.first
  end

  # Start a period. One that was left open before it is closed first: at
  # its usual length, or the day before this one, whichever comes sooner.
  def self.start!(account:, started_on:, usual_length:)
    transaction do
      where(account: account, ended_on: nil).where(started_on: ...started_on).find_each do |open|
        open.update!(ended_on: [open.started_on + (usual_length - 1), started_on - 1].min)
      end
      create!(account: account, started_on: started_on)
    end
  end

  # What this account's log says about its cycle (Kronk::CycleStats). The
  # lengths typed into the old settings stand in until there is a log.
  def self.stats_for(account, logs: nil, today: Time.zone.today)
    profile = CycleProfile.find_by(account_id: account.id)

    Kronk::CycleStats.for(
      logs: logs || where(account: account).to_a,
      today: today,
      fallback: { cycle: profile&.cycle_length, period: profile&.period_length }
    )
  end

  def open?
    ended_on.nil?
  end

  # Days of bleeding, counting both ends. Nil while it is still going.
  def length
    (ended_on - started_on).to_i + 1 if ended_on
  end

  private

  # Guardrail against a fat-finger date well beyond today. A log within
  # a week of today is fine (cycles vary; some may log slightly early).
  def not_in_the_far_future
    return if started_on.blank?

    errors.add(:started_on, 'is too far in the future') if started_on > Time.zone.today + 7
    errors.add(:ended_on, 'is in the future') if ended_on.present? && ended_on > Time.zone.today + 1
  end

  def ends_after_it_starts
    return if started_on.blank? || ended_on.blank?

    errors.add(:ended_on, 'is before the period started') if ended_on < started_on
    errors.add(:ended_on, "is more than #{MAX_LENGTH} days after the period started") if ended_on >= started_on + MAX_LENGTH
  end

  # Two periods cannot cover the same day.
  def apart_from_other_periods
    return if started_on.blank? || account_id.blank?

    last_day = ended_on || started_on
    clash = self.class.where(account_id: account_id).where.not(id: id).any? do |other|
      started_on <= (other.ended_on || other.started_on) && other.started_on <= last_day
    end
    errors.add(:started_on, 'overlaps another period') if clash
  end
end
