# frozen_string_literal: true

# A single photo of a Kar. Same shape as ArtPiecePhoto — plain row with
# media + caption + position. Not Status-backed (all photos by the
# owner; per-photo social interaction would fragment the surface).
class KarPhoto < ApplicationRecord
  belongs_to :kar, inverse_of: :photos
  belongs_to :media_attachment, optional: true

  validates :caption, length: { maximum: 4000 }, allow_blank: true

  scope :ordered, -> { order(position: :asc, created_at: :asc) }

  # Rendered URL — prefers local file, falls back to remote (for
  # federated / externally-hosted media). Nil if the attachment has
  # been vacuumed; the tile renders dark in that case.
  def rendered_url
    return media_attachment.file.url(:original) if media_attachment&.file.present?
    return media_attachment.remote_url if media_attachment && media_attachment.remote_url.present?

    nil
  end
end
