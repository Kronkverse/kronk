# frozen_string_literal: true

# A listener's note on a Booth set, optionally pinned to a moment in it.
# Every member who can see the set sees its shoutouts; the artist gets a
# Nudge (`booth.set.shouted`). The author, the set's owner or a steward
# can remove one.
class BoothShoutout < ApplicationRecord
  BODY_MAX = 500

  belongs_to :account
  belongs_to :booth_set, inverse_of: :shoutouts

  validates :body, presence: true, length: { maximum: BODY_MAX }
  validates :at_seconds, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validate :at_seconds_within_set

  scope :recent, -> { order(created_at: :desc, id: :desc) }

  private

  def at_seconds_within_set
    return if at_seconds.nil? || booth_set&.duration_seconds.nil?

    errors.add(:at_seconds, 'is past the end of the set') if at_seconds > booth_set.duration_seconds
  end
end
