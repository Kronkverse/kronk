# frozen_string_literal: true

# Phase 9.6: Open Rooms — the third Huddle scope alongside the Main
# Huddle and per-Krew Huddles. See docs/spaces/huddle.md § Three
# categories of Huddle.
#
# Adds:
#   * `scope`            — string, one of {main, room, krew}. Every
#                          existing row is a legacy pre-scope session
#                          (which pre-dates the three-category shape);
#                          we default them to `room` since they were
#                          user-created hangouts. The Main Huddle
#                          singleton is upserted at the bottom of this
#                          migration (title: 'Main Huddle').
#   * `icon`             — optional emoji or icon token for a Room.
#   * `last_active_at`   — bumped whenever a participant joins; drives
#                          the 6-month auto-retire reaper for `room`
#                          scope. Existing rows seeded with `updated_at`
#                          so they aren't retired immediately.
#   * `retired_at`       — nullable timestamp; set by the reaper
#                          (soft-delete: retired rows are excluded from
#                          discovery but stay resolvable for old FKs).
#
# strong_migrations: `add_column ... default:` on a large table locks
# it; huddle_sessions is ephemeral + tiny (< 100 rows in prod), so
# `safety_assured` is honest here — the whole table is smaller than a
# single index page. `disable_ddl_transaction!` for the composite
# index create.
class AddRoomScopeToHuddleSessions < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    safety_assured do
      add_column :huddle_sessions, :scope, :string, default: 'room', null: false
      add_column :huddle_sessions, :icon, :string, limit: 32
      add_column :huddle_sessions, :last_active_at, :datetime
      add_column :huddle_sessions, :retired_at, :datetime
    end

    # Seed `last_active_at` from `updated_at` so pre-scope rows start
    # with a plausible activity marker — otherwise the reaper's first
    # run would soft-retire everything created earlier than 6 months
    # ago on day zero.
    execute <<~SQL.squish
      UPDATE huddle_sessions
      SET last_active_at = updated_at
      WHERE last_active_at IS NULL
    SQL

    # Reaper query: rooms where retired_at IS NULL AND last_active_at
    # < N.months.ago. Partial index keeps it small (only live rooms).
    add_index :huddle_sessions,
              [:scope, :last_active_at],
              where: 'retired_at IS NULL',
              name: 'index_huddle_sessions_live_rooms',
              algorithm: :concurrently

    # Singleton Main Huddle. `find_or_create_by`-shape upsert so this
    # migration is idempotent even if a Main row happens to exist
    # (e.g. from earlier manual seed).
    execute <<~SQL.squish
      INSERT INTO huddle_sessions
        (scope, title, session_url, state, host_account_id,
         last_active_at, created_at, updated_at)
      SELECT 'main', 'Main Huddle', 'huddle-main', 'live',
             (SELECT id FROM accounts ORDER BY id ASC LIMIT 1),
             NOW(), NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM huddle_sessions WHERE scope = 'main')
        AND EXISTS (SELECT 1 FROM accounts)
    SQL
  end

  def down
    safety_assured do
      remove_index :huddle_sessions, name: 'index_huddle_sessions_live_rooms'
      remove_column :huddle_sessions, :retired_at
      remove_column :huddle_sessions, :last_active_at
      remove_column :huddle_sessions, :icon
      remove_column :huddle_sessions, :scope
    end
  end
end
