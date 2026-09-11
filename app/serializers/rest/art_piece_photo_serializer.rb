# frozen_string_literal: true

# One photo of an ArtPiece. Multiple angles / detail shots of the same
# work by the same author. Not Status-backed (see ArtPiecePhoto model
# comment) — favourites / replies happen on the piece's feed card, not
# per photo.
class REST::ArtPiecePhotoSerializer < ActiveModel::Serializer
  attributes :id, :caption, :position, :url, :created_at

  def id
    object.id.to_s
  end

  def url
    object.rendered_url
  end

  def created_at
    object.created_at.iso8601
  end
end
