# frozen_string_literal: true

# A listener's note on a Booth set, optionally pinned to a moment in it.
# On an album or EP the moment is in one of its tracks (`booth_set_track`),
# since an album's time runs per track.
# Every member who can see the set sees its shoutouts; the artist gets a
# Nudge (`booth.set.shouted`). The author, the set's owner or a steward
# can remove one.
class BoothShoutout < ApplicationRecord
  BODY_MAX = 500

  belongs_to :account
  belongs_to :booth_set, inverse_of: :shoutouts
  belongs_to :booth_set_track, optional: true

  validates :body, presence: true, length: { maximum: BODY_MAX }
  validates :at_seconds, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validate :at_seconds_within_set
  validate :track_fits_set

  scope :recent, -> { order(created_at: :desc, id: :desc) }

  private

  def at_seconds_within_set
    return if at_seconds.nil?

    length = booth_set_track ? booth_set_track.duration_seconds : booth_set&.duration_seconds
    return if length.nil?

    errors.add(:at_seconds, 'is past the end of the set') if at_seconds > length
  end

  # A moment on an album is in one of its own tracks; one recording has
  # none.
  def track_fits_set
    return if booth_set.nil?

    if booth_set.album?
      errors.add(:booth_set_track, :blank) if at_seconds.present? && booth_set_track.nil?
      errors.add(:booth_set_track, :invalid) if booth_set_track && booth_set_track.booth_set_id != booth_set.id
    elsif booth_set_track
      errors.add(:booth_set_track, :invalid)
    end
  end
end
