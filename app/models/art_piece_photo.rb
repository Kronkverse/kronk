# frozen_string_literal: true

# A single photo of an ArtPiece. Unlike an AlbumPhoto (which is
# Status-backed so favourites / replies flow through the standard
# status pipeline), an ArtPiecePhoto is a plain row: caption is a
# column, and the photo has no independent favourite / reply surface.
# All photos of a piece are by the piece's owner, so per-photo social
# interaction would just fragment the same conversation across N
# rows; the feed card and the piece's detail page are the two
# canonical surfaces for interacting with the piece as a whole.
class ArtPiecePhoto < ApplicationRecord
  belongs_to :art_piece, inverse_of: :photos
  belongs_to :media_attachment, optional: true

  validates :caption, length: { maximum: 4000 }, allow_blank: true

  scope :ordered, -> { order(position: :asc, created_at: :asc) }

  # The URL clients render. Prefers the media attachment's own file URL
  # (locally stored) then falls back to the remote URL (for federated /
  # externally-hosted media). Nil when the attachment has been vacuumed
  # away, in which case the photo renders as a dark tile in the grid.
  def rendered_url
    return media_attachment.file.url(:original) if media_attachment&.file.present?
    return media_attachment.remote_url if media_attachment && media_attachment.remote_url.present?

    nil
  end
end
