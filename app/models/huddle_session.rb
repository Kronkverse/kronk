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
#   * `krew` — one per Krew (Group), scoped to that Krew's members.
#     Phase 9.1 / 9.2 territory — the migration reserves the string
#     but no code path uses it yet.
class HuddleSession < ApplicationRecord
  STATES = %w(draft scheduled live ended).freeze
  SCOPES = %w(main room krew).freeze

  # Threshold after which an idle Room is retired by the reaper. The
  # migration's `last_active_at` seed uses `updated_at` so pre-scope
  # rows aren't retired on day zero of the reaper's first run.
  ROOM_IDLE_RETIRE_AFTER = 6.months

  belongs_to :host_account, class_name: 'Account'
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :huddle_session
  # `has_one :event` retired 2026-08-15 alongside the
  # `events.huddle_session_id` FK drop (Phase 6b). The link now lives
  # in `korner_attachments` — look up the linked event via
  # `KornerAttachment.to_target('huddle', id).where(kind: 'link').first&.source_record`.
  has_many   :huddle_participants, dependent: :destroy
  has_many   :participants, through: :huddle_participants, source: :account

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

  scope :main_scope,    -> { where(scope: 'main') }
  scope :rooms,         -> { where(scope: 'room') }
  scope :krew_huddles,  -> { where(scope: 'krew') }
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

  def krew?
    scope == 'krew'
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

  def main_singleton
    return unless self.class.main_scope.exists?

    errors.add(:scope, 'must be unique — a Main Huddle already exists')
  end
end
