# frozen_string_literal: true

# Trimmed shape of an ArtPiece for timeline embedding on the shared
# Status. Mirrors REST::AlbumSummarySerializer /
# REST::BoothSetSummarySerializer.
class REST::ArtPieceSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :kind, :visibility, :photo_count, :medium, :mediums, :availability

  attribute :cover_url
  attribute :preview_urls
  attribute :owner_acct

  # How many photos a profile's Art tile shows (docs/spaces/art.md, On a
  # profile).
  PREVIEW_COUNT = 4

  def id
    object.id.to_s
  end

  def cover_url
    object.cover_media_attachment&.file&.url(:small).presence ||
      object.photos.ordered.first&.rendered_url
  end

  # The first few photos at thumbnail size, for the profile's Art tile.
  def preview_urls
    object.photos.ordered.includes(:media_attachment).limit(PREVIEW_COUNT).filter_map do |photo|
      file = photo.media_attachment&.file
      file.present? ? file.url(:small) : photo.rendered_url
    end
  end

  def photo_count
    @photo_count ||= object.photos.count
  end

  def owner_acct
    object.owner.acct
  end
end
