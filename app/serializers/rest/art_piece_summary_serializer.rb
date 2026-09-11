# frozen_string_literal: true

# Trimmed shape of an ArtPiece for timeline embedding on the shared
# Status. Mirrors REST::AlbumSummarySerializer /
# REST::BoothSetSummarySerializer.
class REST::ArtPieceSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :kind, :visibility, :photo_count

  attribute :cover_url
  attribute :owner_acct

  def id
    object.id.to_s
  end

  def cover_url
    object.cover_media_attachment&.file&.url(:small).presence ||
      object.photos.ordered.first&.rendered_url
  end

  def photo_count
    @photo_count ||= object.photos.count
  end

  def owner_acct
    object.owner.acct
  end
end
