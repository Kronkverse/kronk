# frozen_string_literal: true

# Trimmed Kar shape for timeline embedding on the shared Status. Mirrors
# REST::ArtPieceSummarySerializer with year/make/model + optional
# location instead of `kind`.
class REST::KarSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :year, :make, :model, :visibility, :photo_count
  attribute :cover_url
  attribute :owner_acct
  attribute :location_label

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

  # Only the human label rides in the summary — the feed card doesn't
  # need to plot the pin, just show "somewhere in <label>". Full lat/lng
  # is in the detail response.
  def location_label
    object.location_label
  end
end
