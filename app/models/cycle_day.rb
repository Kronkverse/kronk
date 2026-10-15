# frozen_string_literal: true

# CycleDay — what one day was like: how heavy the bleed was, symptoms and
# a note. One row per account per day, written whenever the owner likes,
# today or in retrospect, inside a period or not.
#
# Owner-only. Nothing here is ever projected to a viewer: the Circle sees
# a phase name and nothing beneath it (docs/spaces/klot.md).
class CycleDay < ApplicationRecord
  FLOWS = %w(spotting light medium heavy).freeze

  # A fixed list, so the calendar and any later chart can count them.
  SYMPTOMS = %w(
    cramps headache backache tender_breasts bloating nausea
    tired energetic low anxious irritable calm
    cravings acne poor_sleep high_desire
  ).freeze

  MAX_NOTE = 500

  belongs_to :account

  validates :day, presence: true, uniqueness: { scope: :account_id }
  validates :flow, inclusion: { in: FLOWS }, allow_nil: true
  validates :note, length: { maximum: MAX_NOTE }
  validate  :not_in_the_future

  scope :between, ->(from, to) { where(day: from..to).order(:day) }

  def symptoms=(value)
    super(Array(value).map(&:to_s) & SYMPTOMS)
  end

  def flow=(value)
    super(value.presence)
  end

  def note=(value)
    super(value.to_s.strip)
  end

  # A day with nothing on it is not kept.
  def blank_entry?
    flow.nil? && symptoms.empty? && note.blank?
  end

  private

  def not_in_the_future
    errors.add(:day, 'is in the future') if day.present? && day > Time.zone.today + 1
  end
end
