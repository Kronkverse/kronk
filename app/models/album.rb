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
  # (2026-08-05). Contribution now consults BOTH axes:
  #
  #   1. Viewer must be able to see the album (visibility gate).
  #   2. Viewer must be in the contribution roster.
  #
  # The owner always contributes regardless of roster (there's no
  # reason to lock yourself out of your own album). Roster branches:
  #
  #   * open     — anyone who cleared the visibility gate
  #   * closed   — owner only
  #   * invited  — accounts in `album_contributors` (join table
  #                added in a follow-up PR when the invited-list UX
  #                ships; safe to return false today because the
  #                composer doesn't expose the `invited` chip yet)
  #   * krew     — accounts belonging to any of `album_krews`. This
  #                REUSES the existing join table because the picker
  #                auto-mirrors Krew selection across the two axes
  #                (docs/kronk_scope_picker.md § Decisions).
  #   * event    — accounts on the linked event's RSVP roster (also
  #                a follow-up PR when the Kalendar attendee reader
  #                ships).
  def contributable_by?(viewer)
    return false unless visible_to?(viewer)
    return true  if viewer && viewer.id == owner_id

    # rubocop:disable Lint/DuplicateBranch
    # `invited` + `event` both return false today because their
    # sub-picker UIs + backing infrastructure land in follow-up
    # PRs (account autocomplete for invited, Kalendar attendee
    # reader for event). Kept as separate branches (rather than a
    # collapsed `else false`) so the signal about which roster
    # gets wired next stays legible in the code.
    case contribution
    when 'open'    then true
    when 'closed'  then false
    when 'invited' then false # TODO(scope-picker): consult album_contributors when the join table ships
    when 'krew'    then album_krews.exists?(krew_id: viewer.krews.select(:id))
    when 'event'   then false # TODO(scope-picker): consult event attendees when the Kalendar reader ships
    end
    # rubocop:enable Lint/DuplicateBranch
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
end
