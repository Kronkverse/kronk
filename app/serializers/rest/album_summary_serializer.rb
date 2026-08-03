# frozen_string_literal: true

# Trimmed shape of an Album for timeline embedding on the shared
# Status. Mirrors REST::ProposalSummarySerializer /
# REST::BoothSetSummarySerializer / REST::TrekSummarySerializer.
class REST::AlbumSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :visibility, :contributor_count, :photo_count

  attribute :cover_url
  attribute :contributor_avatars

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

  # Up to 5 contributor avatars — the "who's building this" signal on
  # the feed card. Ordered by their first contribution (oldest first)
  # so the strip is stable across renders.
  def contributor_avatars
    first_by_account = object.photos.with_status.group(:contributor_id).minimum(:created_at)
    ids = first_by_account.sort_by { |_id, ts| ts }.first(5).map(&:first)
    Account.where(id: ids).index_by(&:id).values_at(*ids).compact.map do |a|
      { id: a.id.to_s, acct: a.acct, avatar: a.avatar_original_url }
    end
  end
end
