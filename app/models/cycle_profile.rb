# frozen_string_literal: true

# CycleProfile — per-account Klot settings. One row per account (unique
# index on account_id). Auto-populated with defaults if the owner never
# touches the settings screen.
#
# `cycle_length` and `period_length` are owner-only fields (never
# projected to viewers — see KRONK_TIDES §Consent invariants). The
# viewer-facing `phase` is derived server-side from these + the newest
# CycleLog via Kronk::CyclePhase.
class CycleProfile < ApplicationRecord
  belongs_to :account

  # Sensible clamps. Real menstrual cycles vary widely, but values
  # outside these ranges are almost always typos.
  MIN_CYCLE_LENGTH  = 15
  MAX_CYCLE_LENGTH  = 60
  MIN_PERIOD_LENGTH = 1
  MAX_PERIOD_LENGTH = 14

  validates :cycle_length,  numericality: { only_integer: true, greater_than_or_equal_to: MIN_CYCLE_LENGTH,  less_than_or_equal_to: MAX_CYCLE_LENGTH }
  validates :period_length, numericality: { only_integer: true, greater_than_or_equal_to: MIN_PERIOD_LENGTH, less_than_or_equal_to: MAX_PERIOD_LENGTH }
  validate  :period_shorter_than_cycle

  def self.for!(account)
    find_or_create_by!(account: account)
  end

  private

  def period_shorter_than_cycle
    return if period_length.blank? || cycle_length.blank?

    errors.add(:period_length, 'must be shorter than cycle_length') unless period_length < cycle_length
  end
end
