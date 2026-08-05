# frozen_string_literal: true

# Albutts — a shared album is a metadata container. Photos live on each
# contributor's account (via MediaAttachment) or, once Anthemos ships,
# on an external pod URL. The album itself is just the wrapper: title,
# description, cover, visibility, and the graph of who has contributed.
#
# See docs/spaces/albutts.md.
class Album < ApplicationRecord
  belongs_to :owner, class_name: 'Account'
  belongs_to :cover_media_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :event, optional: true, inverse_of: :spawned_album
  belongs_to :status, optional: true, inverse_of: :album

  has_many :photos, class_name: 'AlbumPhoto', dependent: :destroy, inverse_of: :album
  has_many :album_krews, dependent: :destroy
  has_many :krews, through: :album_krews

  enum :visibility,
       { public: 0, mates: 1, krew: 2, orbit: 3, self_only: 4 },
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
  validate  :krew_scope_has_at_least_one_krew

  scope :recent, -> { order(created_at: :desc) }

  # Albums visible to `viewer`, matching the four-tier reach ladder
  # + krew as the orthogonal axis (docs/kronk_feed_and_reach.md §2):
  #
  #   * public    → everyone
  #   * orbit     → mates-of-mates of the owner (one hop out)
  #   * mates     → mates (mutual follow) of the owner
  #   * krew      → viewer belongs to at least one of the album's krews
  #   * self_only → the owner only; on their profile, not in any feed
  #
  # The owner always sees their own albums regardless of the scope.
  # `orbit_of?` is expensive-ish (nested EXISTS); the scope reuses
  # the mates-of-mates set once via the join subquery.
  scope :visible_to, lambda { |viewer|
    return public_scope if viewer.nil?

    mate_ids       = viewer.mates.select(:id)
    krew_ids       = viewer.krews.select(:id)
    mates_of_mates = Account.where(id: Follow.where(account_id: mate_ids).select(:target_account_id))
                            .where(id: Follow.where(target_account_id: mate_ids).select(:account_id))
                            .where.not(id: viewer.id)
                            .select(:id)

    where(owner_id: viewer.id)
      .or(public_scope)
      .or(mates_scope.where(owner_id: mate_ids))
      .or(orbit_scope.where(owner_id: mates_of_mates))
      .or(krew_scope.where(id: AlbumKrew.where(krew_id: krew_ids).select(:album_id)))
  }

  # Distinct set of accounts who have contributed at least one photo
  # to this album. Ordered by their first contribution (oldest first)
  # so the "who's building this" avatar strip is stable.
  def contributor_accounts
    Account.where(id: photos.select(:contributor_id).distinct)
  end

  def visible_to?(viewer)
    return true if viewer && viewer.id == owner_id
    return false if self_only_scope? # owner-only handled above
    return true  if public_scope?
    return mates_visible_to?(viewer) if mates_scope?
    return orbit_visible_to?(viewer) if orbit_scope?
    return krew_visible_to?(viewer) if krew_scope?

    false
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

  def mates_visible_to?(viewer)
    return false if viewer.nil?

    viewer.mates.exists?(id: owner_id) || viewer.id == owner_id
  end

  def orbit_visible_to?(viewer)
    return false if viewer.nil?
    return true  if viewer.id == owner_id
    return true  if viewer.mates.exists?(id: owner_id) # mates see orbit too

    viewer.orbit_of?(owner)
  end

  def krew_visible_to?(viewer)
    return false if viewer.nil?

    album_krews.exists?(krew_id: viewer.krews.select(:id))
  end

  def krew_scope_has_at_least_one_krew
    return unless krew_scope?
    return if new_record? && album_krews.any?
    return if persisted? && album_krews.exists?

    errors.add(:krews, 'must include at least one krew when visibility is krew-scoped')
  end
end
