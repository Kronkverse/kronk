# frozen_string_literal: true

# Full Albutts album envelope — the shape returned by
# `/api/v1/albutts/albums` (index/show/create/update). Trimmed shape
# for feed embedding lives in REST::AlbumSummarySerializer.
class REST::AlbumSerializer < ActiveModel::Serializer
  attributes :id, :slug, :title, :description, :visibility, :contribution,
             :contributor_count, :photo_count, :created_at

  attribute :cover_url
  attribute :cover_media_attachment_id
  attribute :is_owner
  attribute :can_contribute
  # Krew albums (docs/spaces/albutts.md): the Krew it belongs to, who sees it
  # ('krew' | 'everyone'), and what the viewer may do with it.
  attribute :krew_id
  attribute :krew_name, if: -> { object.krew_album? }
  attribute :audience
  attribute :can_manage
  attribute :can_delete
  # Asking to add photos (docs/spaces/albutts.md): whether the viewer has
  # asked, and, for the owner, how many are asking.
  attribute :contribution_requested, unless: :list?
  attribute :contribution_requests_count, if: :owner_detail?

  # Additive contribution roster (docs/spaces/albutts.md). `contribution_open`
  # is the base (anyone who can see may add); when false, the roster is the
  # union of `invited_contributor_ids` (specific people) and the members of
  # `contributor_krew_ids`. `krews` (below) is the full audience-krew set.
  attribute :contribution_open
  attribute :contributor_krew_ids
  attribute :invited_contributor_ids

  belongs_to :owner, serializer: REST::AccountSerializer
  # The list of albums shows a cover and a count, so it is sent without
  # the photos (`list: true`): with them, one page of albums carried every
  # photo of every album, each with its whole post.
  has_many   :photos, serializer: REST::AlbumPhotoSerializer, unless: :list?
  has_many   :krews, serializer: REST::KrewSerializer, if: :krews?

  def id
    object.id.to_s
  end

  # Filter through `with_status` so legacy photos (pre-2026-07-31
  # refactor, `status_id = NULL`) don't reach the client — the client
  # types + rendering assume `photo.status` is non-null.
  # Loaded with what each photo's post needs (`AlbumPhoto.for_display`), in
  # a handful of queries however many photos there are. The controller
  # hands them over when it has already loaded them.
  def photos
    instance_options[:photos] || object.photos.for_display.to_a
  end

  def list?
    instance_options[:list] == true
  end

  # The chosen cover, so the lightbox can tell which photo it is. Nil when
  # the owner has not chosen (the first photo then stands in).
  def cover_media_attachment_id
    object.cover_media_attachment_id&.to_s
  end

  def cover_url
    object.cover_media_attachment&.file&.url(:small).presence ||
      object.photos.with_status.chronological.preload(status: :media_attachments).first&.thumb_url
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

  def krew_id
    object.krew_id&.to_s
  end

  # Shown as a chip on the album's card (docs/spaces/albutts.md, Krew albums).
  def krew_name
    object.krew.name
  end

  def can_manage
    object.managed_by?(current_user&.account)
  end

  def can_delete
    object.deletable_by?(current_user&.account)
  end

  def contribution_requested
    return false unless current_user&.account_id

    object.contribution_requests.exists?(account_id: current_user.account_id)
  end

  def owner_detail?
    !list? && is_owner
  end

  def contribution_requests_count
    object.contribution_requests.count
  end

  def can_contribute
    return false unless current_user&.account

    object.contributable_by?(current_user.account)
  end

  def created_at
    object.created_at.iso8601
  end

  # Krew is orthogonal now — expose the album's krews whenever it targets any,
  # regardless of reach tier. An invite-only Krew is named only to its
  # members (Kronk::VisibleKrews).
  def krews?
    object.album_krews.exists?
  end

  def krews
    Kronk::VisibleKrews.filter(object.krews.to_a, current_user&.account)
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
