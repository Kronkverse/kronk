# frozen_string_literal: true

# Full Albutts album envelope — the shape returned by
# `/api/v1/albutts/albums` (index/show/create/update). Trimmed shape
# for feed embedding lives in REST::AlbumSummarySerializer.
class REST::AlbumSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :visibility, :contribution,
             :contributor_count, :photo_count, :created_at

  attribute :cover_url
  attribute :is_owner
  attribute :can_contribute

  # Additive contribution roster (docs/spaces/albutts.md). `contribution_open`
  # is the base (anyone who can see may add); when false, the roster is the
  # union of `invited_contributor_ids` (specific people) and the members of
  # `contributor_krew_ids`. `krews` (below) is the full audience-krew set.
  attribute :contribution_open
  attribute :contributor_krew_ids
  attribute :invited_contributor_ids

  belongs_to :owner, serializer: REST::AccountSerializer
  has_many   :photos, serializer: REST::AlbumPhotoSerializer
  has_many   :krews, serializer: REST::KrewSerializer, if: :krews?

  def id
    object.id.to_s
  end

  # Filter through `with_status` so legacy photos (pre-2026-07-31
  # refactor, `status_id = NULL`) don't reach the client — the client
  # types + rendering assume `photo.status` is non-null.
  def photos
    object.photos.with_status
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

  def is_owner
    return false unless current_user&.account_id

    object.owner_id == current_user.account_id
  end

  def can_contribute
    return false unless current_user&.account

    object.contributable_by?(current_user.account)
  end

  def created_at
    object.created_at.iso8601
  end

  # Krew is orthogonal now — expose the album's krews whenever it targets any,
  # regardless of reach tier.
  def krews?
    object.album_krews.exists?
  end

  def contribution_open
    object.contribution_open?
  end

  # The subset of the album's krews that also grant contribution.
  def contributor_krew_ids
    object.album_krews.where(for_contribution: true).pluck(:krew_id).map(&:to_s)
  end

  # Specific accounts on the contribution roster (the "invited" people).
  def invited_contributor_ids
    object.album_contributors.pluck(:account_id).map(&:to_s)
  end
end
