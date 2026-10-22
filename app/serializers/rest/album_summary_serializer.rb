# frozen_string_literal: true

# Trimmed shape of an Album for timeline embedding on the shared
# Status. Mirrors REST::ProposalSummarySerializer /
# REST::BoothSetSummarySerializer / REST::TrekSummarySerializer.
class REST::AlbumSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :visibility, :contributor_count, :photo_count

  attribute :cover_url
  attribute :contributor_avatars
  attribute :preview_urls

  def id
    object.id.to_s
  end

  def cover_url
    object.cover_media_attachment&.file&.url(:small).presence ||
      object.photos.with_status.chronological.first&.rendered_url
  end

  def contributor_count
    @contributor_count ||= object.photos.with_status.distinct.count(:contributor_id)
  end

  def photo_count
    @photo_count ||= object.photos.with_status.count
  end

  # Up to 5 contributor faces — the "who's building this" signal on
  # the feed card, in place of a count.
  def contributor_avatars
    object.contributor_faces(5)
  end

  # Two photos besides the cover, so the card can show a mosaic.
  def preview_urls
    object.preview_photo_urls(2)
  end
end
