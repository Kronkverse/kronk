# frozen_string_literal: true

# CycleLog — the manual period log. Ordered `started_on desc`; the
# newest row anchors the phase calculation. Hard-delete on removal
# (KRONK_TIDES §Consent invariants — "logs hard-delete, nothing is
# retained").
class CycleLog < ApplicationRecord
  belongs_to :account

  validates :started_on, presence: true
  validate  :not_in_the_far_future

  scope :newest_first, -> { order(started_on: :desc) }

  # Anchors the phase calculation for an account.
  def self.most_recent_for(account)
    where(account: account).newest_first.first
  end

  private

  # Guardrail against a fat-finger date well beyond today. A log within
  # a week of today is fine (cycles vary; some may log slightly early).
  def not_in_the_far_future
    return if started_on.blank?

    errors.add(:started_on, 'is too far in the future') if started_on > Time.zone.today + 7
  end
end
