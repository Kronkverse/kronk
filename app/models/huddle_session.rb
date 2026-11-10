# frozen_string_literal: true

# Kronk Huddle — its own korner in 2.0.0. A live video session with an
# optional schedule, an optional linked Kalendar event, and its own
# participants log. Feed projection lands via the canonical status_id
# per §5.5 when a huddle wants to appear in the timeline.
#
# Three scopes (docs/spaces/huddle.md § Three categories of Huddle):
#
#   * `main` — singleton row, the perpetual universal Main Huddle.
#     Never retired. Bootstrapped by the AddRoomScopeToHuddleSessions
#     migration.
#   * `room` — open topical Rooms (Coworking, Meetings, Music, …).
#     Anyone signed in can create one via HuddleRoom::CreateService;
#     the reaper (HuddleRoomReaper) soft-retires rooms with no session
#     activity for 6 continuous months.
#   * `space` — a Krew's, projekt's or Komponent's own Kuddle (Tal,
#     2026-11-10), one each, made the first time someone Konnects Kuddle
#     to it (HuddleSession.for_space!). Only the space's members see it
#     and get in; a Komponent's members are its projekt's. Not listed on
#     /hub/huddle and never reaped. (`krew` was reserved for this and
#     never used.)
class HuddleSession < ApplicationRecord
  include Kronk::AttachmentSource

  self.attachment_source_slug = 'huddle'

  STATES = %w(draft scheduled live ended).freeze
  SCOPES = %w(main room space).freeze
  # What people call a Kuddle: an open Room or a space's own.
  KUDDLE_SCOPES = %w(room space).freeze

  # Threshold after which an idle Room is retired by the reaper. The
  # migration's `last_active_at` seed uses `updated_at` so pre-scope
  # rows aren't retired on day zero of the reaper's first run.
  ROOM_IDLE_RETIRE_AFTER = 6.months

  # Who made it. Nil once that account is purged: a Kuddle isn't owned by
  # anyone, so it stays, and with no maker anyone signed in looks after it
  # (Kronk::KornerRecords, Kronk::CallTarget; decisions.md, 2026-10-29).
  belongs_to :host_account, class_name: 'Account', optional: true
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :huddle_session
  # `has_one :event` retired 2026-08-15 alongside the
  # `events.huddle_session_id` FK drop (Phase 6b). The link now lives
  # in `korner_attachments` — look up the linked event via
  # `KornerAttachment.to_target('huddle', id).where(kind: 'link').first&.source_record`.
  has_many   :huddle_participants, dependent: :destroy
  has_many   :participants, through: :huddle_participants, source: :account
  # Follow / Unfollow on a Kuddle (docs/spaces/huddle.md, Following a
  # Kuddle). Huddle::Follows adds the Krew members who follow without a row.
  has_many   :huddle_follows, dependent: :delete_all
  # A Kuddle's recordings (docs/spaces/huddle.md, Recordings). Destroying
  # deletes their files; the app retires a Kuddle rather than deleting it,
  # which keeps them, and purging its maker leaves it too.
  has_many   :call_recordings, dependent: :destroy
  # The space a `space` Kuddle is its own (one of the two).
  belongs_to :krew, optional: true
  belongs_to :freethedream_project, class_name: 'Freethedream::Project', optional: true

  validates :title, presence: true, length: { maximum: 200 }
  validates :session_url, presence: true, length: { maximum: 400 }
  validates :state, inclusion: { in: STATES }
  validates :scope, inclusion: { in: SCOPES }
  validates :icon, length: { maximum: 32 }, allow_blank: true

  # Singleton invariant on `main` — at most one row per scope. Enforced
  # at the model level (the DB partial-index for open rooms doesn't
  # cover this because Main is never retired and we want exactly one
  # global row, not one-per-anything).
  validate :main_singleton, on: :create, if: -> { scope == 'main' }
  validate :one_space, on: :create, if: :space?

  scope :main_scope,    -> { where(scope: 'main') }
  scope :rooms,         -> { where(scope: 'room') }
  scope :spaces,        -> { where(scope: 'space') }
  scope :kuddles,       -> { where(scope: KUDDLE_SCOPES) }
  scope :live,          -> { where(state: 'live') }
  scope :scheduled,     -> { where(state: 'scheduled') }
  scope :upcoming,      -> { where('scheduled_start > ?', Time.now.utc).order(scheduled_start: :asc) }
  scope :not_retired,   -> { where(retired_at: nil) }
  scope :retired,       -> { where.not(retired_at: nil) }
  # Rooms that have been idle long enough for the reaper to sweep.
  scope :room_reap_candidates, lambda {
    rooms.not_retired.where(last_active_at: ..ROOM_IDLE_RETIRE_AFTER.ago)
  }

  def live?
    state == 'live'
  end

  def ended?
    state == 'ended'
  end

  def retired?
    retired_at.present?
  end

  def main?
    scope == 'main'
  end

  def room?
    scope == 'room'
  end

  def space?
    scope == 'space'
  end

  # The Krew or projekt (or Komponent) this is the own Kuddle of.
  def space
    krew || freethedream_project
  end

  # Account ids of everyone in its space.
  def space_member_ids
    case space
    when Krew then KrewMembership.where(krew_id: krew_id).pluck(:account_id)
    when Freethedream::Project then Freethedream::Membership.member.where(project_id: space.top_id).pluck(:account_id)
    else []
    end
  end

  # May `account` see and get into it? An open Room, anyone signed in; a
  # space's own, its members (none once its space is gone).
  def open_to?(account)
    return false if account.nil? || retired?
    return true unless space?

    space.present? && space.member?(account)
  end

  # A space's own Kuddle, made the first time it's asked for. Whoever
  # makes it follows it, as with any Kuddle; the members follow it by
  # being members (Huddle::Follows).
  def self.for_space!(space, account)
    column = space.is_a?(Krew) ? :krew : :freethedream_project
    found = spaces.find_by(column => space)
    return found if found

    name = space.is_a?(Krew) ? space.name : space.title
    transaction do
      session = create!(:scope => 'space', column => space, :title => name.to_s[0, 80], :host_account => account,
                        :session_url => HuddleRoom::CreateService.room_key(name.to_s), :state => 'live', :last_active_at => Time.current)
      HuddleFollow.create!(account: account, huddle_session: session)
      session
    end
  rescue ActiveRecord::RecordNotUnique
    spaces.find_by!(column => space)
  end

  # Called by the join path (frontend hits POST /join or the Jitsi
  # participant-joined webhook, whichever lands first) to bump the
  # last-active marker. Guards the reaper from picking off a Room
  # that's currently in use. `touch: false` on update! would skip
  # `updated_at`; we want both here — activity is activity.
  def bump_activity!
    update!(last_active_at: Time.current)
  end

  # Soft-delete. Retired rooms drop out of discovery but the row (and
  # therefore any historical FK, e.g. a Kalendar event that once
  # pointed here) still resolves. Not reversible via a "resurrect"
  # affordance — if users want a Room again, they re-create it.
  def retire!
    return false if retired?

    update!(retired_at: Time.current)
    Kronk::KornerEvents.publish(
      'huddle.room.retired',
      huddle_session_id: id,
      title: title
    )
    true
  end

  def start!
    return false if live? || ended?

    update!(state: 'live', ended_at: nil)
    Kronk::KornerEvents.publish('huddle.started', huddle_session_id: id, host_account_id: host_account_id)
    true
  end

  def end!
    return false unless live?

    update!(state: 'ended', ended_at: Time.current)
    Kronk::KornerEvents.publish('huddle.ended', huddle_session_id: id, host_account_id: host_account_id)
    true
  end

  private

  def one_space
    errors.add(:base, 'a space Kuddle belongs to one Krew or projekt') unless [krew_id, freethedream_project_id].compact.one?
  end

  def main_singleton
    return unless self.class.main_scope.exists?

    errors.add(:scope, 'must be unique — a Main Huddle already exists')
  end
end
