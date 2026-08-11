# frozen_string_literal: true

# Albutts — a shared album is a metadata container. Photos live on each
# contributor's account (via MediaAttachment) or, once Anthemos ships,
# on an external pod URL. The album itself is just the wrapper: title,
# description, cover, visibility, and the graph of who has contributed.
#
# See docs/spaces/albutts.md.
class Album < ApplicationRecord
  include Reachable

  belongs_to :owner, class_name: 'Account'
  belongs_to :cover_media_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :event, optional: true, inverse_of: :spawned_album
  belongs_to :status, optional: true, inverse_of: :album

  has_many :photos, class_name: 'AlbumPhoto', dependent: :destroy, inverse_of: :album
  has_many :album_krews, dependent: :destroy
  has_many :krews, through: :album_krews

  # Contribution roster (docs/spaces/albutts.md) — who MAY add photos when the
  # album isn't `open`. Additive: specific people (`album_contributors`) ∪
  # members of contributor krews (the `album_krews` flagged `for_contribution`;
  # a contributor krew is always also an audience krew — you must see an album
  # to add to it). Membership is read via scoped queries in `contributable_by?`.
  has_many :album_contributors, dependent: :destroy

  # Reach ladder. Krew is an ORTHOGONAL, additive axis (via album_krews) — a
  # krew member sees the album on top of its reach tier — not a rung here
  # (krew:2 retired 2026-08-10 → self_only; gap intentional). See Reachable.
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope

  # Kronk Scope Picker — contribution axis. See
  # docs/kronk_scope_picker.md. Split from visibility so an owner
  # can e.g. keep a mates-visible album but restrict adds to only
  # themselves (`closed`). Enum values match the `ContributionRoster`
  # TypeScript union in `components/scope_picker.tsx` verbatim.
  #
  # `open` is the NEW-row default (matches how albums have always
  # behaved before this split). Existing albums were bulk-set to
  # `closed` on migration per Tal's 2026-08-05 call — owners must
  # actively open them back up now that the picker exists.
  #
  # `invited` / `krew` (as a contribution roster) / `event` are
  # part of the vocabulary but require infrastructure that lands
  # in follow-up PRs (account autocomplete for invited, event
  # attendee query for event). Model accepts them today so the
  # data path is ready; composer offers only open/closed in v1.
  enum :contribution,
       { open: 0, closed: 1, invited: 2, krew: 3, event: 4 },
       prefix: :contribution

  validates :title, presence: true, length: { maximum: 240 }
  validates :description, length: { maximum: 4000 }, allow_blank: true

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
    return true  if viewer && viewer.id == owner_id
    return true  if contribution_open?

    invited_to_contribute?(viewer) || contributor_krew_member?(viewer)
  end

  private

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
end
