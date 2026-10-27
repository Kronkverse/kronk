# frozen_string_literal: true

# == Schema Information
#
# Table name: booth_set_tracks
#
#  id                  :bigint(8)        not null, primary key
#  duration_seconds    :integer
#  position            :integer          default(0), not null
#  title               :string           not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  audio_attachment_id :bigint(8)        not null
#  booth_set_id        :bigint(8)        not null
#

# One track of an album or EP (docs/spaces/booth.md, Albums): its own audio
# file, its place in the running order and its name. A set's timestamped
# track list (`booth_sets.tracklist`) is something else: names over one
# recording.
class BoothSetTrack < ApplicationRecord
  TITLE_MAX = 200
  DURATION_MAX = 24 * 60 * 60

  belongs_to :booth_set, inverse_of: :tracks
  belongs_to :audio_attachment, class_name: 'MediaAttachment'

  validates :title, presence: true, length: { maximum: TITLE_MAX }
  validates :duration_seconds, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: DURATION_MAX }, allow_nil: true

  # How long an uploaded file is, from what media processing read out of it
  # (whole seconds), or nil while it is still processing.
  def self.media_duration(media)
    meta = media&.file&.meta
    seconds = meta.is_a?(Hash) ? (meta.dig('original', 'duration') || meta.dig(:original, :duration)) : nil
    seconds.to_f.positive? ? seconds.to_f.round.clamp(1, DURATION_MAX) : nil
  end

  def audio_url
    audio_attachment&.file&.url(:original)
  end
end
