# frozen_string_literal: true

# Albutts — a shared album is a metadata container. Photos live on each
# contributor's account (via MediaAttachment) or, once Anthemos ships,
# on an external pod URL. The album itself is just the wrapper: title,
# description, cover, visibility, and the graph of who has contributed.
#
# See docs/spaces/albutts.md.
class Album < ApplicationRecord
  include Reachable
  include Kronk::AttachmentSource
  include Kronk::NamedLink

  self.attachment_source_slug = 'albutts'

  belongs_to :owner, class_name: 'Account'
  # A Krew album belongs to its Krew, not to whoever made it
  # (docs/spaces/albutts.md, Krew albums). `owner` stays the maker, for
  # credit; what the owner of a personal album may do, any member may do here.
  belongs_to :krew, optional: true
  belongs_to :cover_media_attachment, class_name: 'MediaAttachment', optional: true
  # `belongs_to :event` retired 2026-08-14 alongside the
  # `albums.event_id` FK drop — the Kalendar → Albutts link now lives
  # as a `korner_attachments` row (docs/korners/adding_a_korner.md (Korner attachments)
  # Phase 5). Callers that want the source event look it up via
  # `KornerAttachment.to_target('albutts', id).where(kind: 'spawn').first&.source_record`.
  belongs_to :status, optional: true, inverse_of: :album

  has_many :photos, class_name: 'AlbumPhoto', dependent: :destroy, inverse_of: :album
  # The feed posts for photos added later ("Ash added 20 photos to …").
  has_many :photo_batches, class_name: 'AlbumPhotoBatch', dependent: :destroy, inverse_of: :album

  # The album's own post, its photos' posts and its "added photos" posts:
  # what a Krew linked to the album has to reach too (Kronk::StatusKrews),
  # and what moves when its reach does (Albutts::RescopeAlbum).
  def post_status_ids
    [status_id, *photos.pluck(:status_id), *photo_batches.pluck(:status_id)].compact
  end
  has_many :album_krews, dependent: :destroy
  has_many :krews, through: :album_krews

  # Contribution roster (docs/spaces/albutts.md) — who MAY add photos when the
  # album isn't `open`. Additive: specific people (`album_contributors`) ∪
  # members of contributor krews (the `album_krews` flagged `for_contribution`;
  # a contributor krew is always also an audience krew — you must see an album
  # to add to it). Membership is read via scoped queries in `contributable_by?`.
  has_many :album_contributors, dependent: :destroy
  has_many :contribution_requests, class_name: 'AlbumContributionRequest', dependent: :delete_all, inverse_of: :album

  # Reach ladder. Krew is an ORTHOGONAL, additive axis (via album_krews) — a
  # krew member sees the album on top of its reach tier — not a rung here
  # (krew:2 retired 2026-08-10 → self_only; gap intentional). See Reachable.
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope

  # Contribution axis — who may ADD photos, split from who can see.
  # See docs/spaces/albutts.md (Who can add photos). `closed` (owner
  # only) is what the composer and the API make by default since
  # 2026-10-19; `open` or `invited` plus the roster are opt-in. The
  # column's own default is still `open` (spawned event albums say so
  # explicitly). `krew` is accepted from legacy clients; `event` has no
  # attendee reader yet, so such albums are owner-only.
  enum :contribution,
       { open: 0, closed: 1, invited: 2, krew: 3, event: 4 },
       prefix: :contribution

  # A Krew album is seen by the Krew only, or by everyone on Kronk, and only a
  # Krew listed in Discover can show its albums to everyone.
  KREW_AUDIENCES = { 'krew' => 'self_only', 'everyone' => 'public' }.freeze

  validates :title, presence: true, length: { maximum: 240 }
  validate  :krew_album_audience, if: :krew_album?
  validates :description, length: { maximum: 4000 }, allow_blank: true
  validate  :cover_is_a_photo_in_the_album, if: -> { cover_media_attachment_id.present? && will_save_change_to_cover_media_attachment_id? }

  scope :recent, -> { order(created_at: :desc) }

  # Reachable adapter — reach + additive-krew visibility (visible_to /
  # visible_to?) lives in the concern; these tell it how an Album stores its
  # owner + its (multiple) krews.
  def self.reachable_owner_column
    :owner_id
  end

  def self.reachable_krew_scope(krew_ids)
    where(id: AlbumKrew.where(krew_id: krew_ids).select(:album_id))
  end

  # Distinct set of accounts who have contributed at least one photo
  # to this album. Ordered by their first contribution (oldest first)
  # so the "who's building this" avatar strip is stable.
  def contributor_accounts
    Account.where(id: photos.select(:contributor_id).distinct)
  end

  # Split from `visible_to?` per the Kronk Scope Picker rollout
  # (2026-08-05); made an additive roster 2026-08-11. Contribution
  # consults BOTH axes:
  #
  #   1. Viewer must be able to see the album (visibility gate).
  #   2. Then, unless the album is `open`, the viewer must be on the
  #      contribution roster.
  #
  # The owner always contributes (no reason to lock yourself out).
  # `open` means anyone who cleared the visibility gate. Otherwise the
  # roster is additive — the union of:
  #   * specific people   — `album_contributors` (the "invited" list), and
  #   * contributor krews — `album_krews` flagged `for_contribution`.
  # (`event`-sourced rosters — the Kalendar attendee reader — remain a
  # follow-up; such albums contribute owner-only until it ships, matching
  # their prior behaviour.)
  def contributable_by?(viewer)
    return false unless visible_to?(viewer)
    # A Krew album: its members add, nobody else.
    return viewer.present? && krew.member?(viewer) if krew_album?
    return true  if viewer && viewer.id == owner_id
    return true  if contribution_open?

    invited_to_contribute?(viewer) || contributor_krew_member?(viewer)
  end

  def krew_album?
    krew_id.present?
  end

  # 'krew' or 'everyone', for a Krew album.
  def audience
    KREW_AUDIENCES.key(visibility) if krew_album?
  end

  # Who can edit it: the owner of a personal album, any member of a Krew
  # album's Krew.
  def managed_by?(account)
    return false if account.nil?

    krew_album? ? krew.member?(account) : owner_id == account.id
  end

  # Nobody deletes a Krew album alone, unless they are all that's left of the
  # Krew (the same rule as archiving it).
  def deletable_by?(account)
    return false if account.nil?

    krew_album? ? krew.sole_member?(account) : owner_id == account.id
  end

  private

  def krew_album_audience
    hidden_krew_shown_to_everyone = public_scope? && !krew.listed? && (will_save_change_to_visibility? || will_save_change_to_krew_id?)
    errors.add(:visibility, :invalid) if KREW_AUDIENCES.values.exclude?(visibility) || hidden_krew_shown_to_everyone
  end

  # Reachable adapter (instance side).
  def reachable_owner_id
    owner_id
  end

  def reachable_owner
    owner
  end

  def reachable_krew_member?(viewer)
    return false if viewer.nil?

    album_krews.exists?(krew_id: viewer.krews.select(:id))
  end

  # Contribution-roster membership (only consulted for non-`open` albums).
  def invited_to_contribute?(viewer)
    return false if viewer.nil?

    album_contributors.exists?(account_id: viewer.id)
  end

  def contributor_krew_member?(viewer)
    return false if viewer.nil?

    album_krews.where(for_contribution: true).exists?(krew_id: viewer.krews.select(:id))
  end

  # The owner picks the cover from the album's own photos; without this the
  # id of any upload at all would be accepted.
  def cover_is_a_photo_in_the_album
    return if photos.joins(status: :media_attachments).exists?(media_attachments: { id: cover_media_attachment_id })

    errors.add(:cover_media_attachment_id, :invalid)
  end
end
