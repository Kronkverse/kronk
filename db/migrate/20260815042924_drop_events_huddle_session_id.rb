# frozen_string_literal: true

# Phase 6b — retires the `events.huddle_session_id` FK column now that
# the Kalendar → Huddle link lives in `korner_attachments` and every
# reader has migrated (docs/kronk_korner_attachments.md §5).
#
# The Phase 6 backfill (20260815041537) copied every populated row
# into `korner_attachments` as `(kalendar, huddle, link)`; the rake
# task `kronk:huddle:backfill` now writes to that join too (in the
# same PR). Every code path that used to read from the FK is either
# gone (`HuddleSession.has_one :event`,
# `Event#publish_kalendar_event_created` payload key) or reads via
# the join.
#
# Rollback: re-adds the column + index + FK but does not backfill
# values. If a rollback is needed, backfill from `korner_attachments`
# after the schema is restored:
#
#   UPDATE events e SET huddle_session_id = ka.target_id
#   FROM korner_attachments ka
#   WHERE ka.source_slug = 'kalendar'
#     AND ka.target_slug = 'huddle'
#     AND ka.source_id = e.id
#     AND ka.kind = 'link';
class DropEventsHuddleSessionId < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      remove_foreign_key :events, :huddle_sessions if foreign_key_exists?(:events, :huddle_sessions)
      remove_index :events, :huddle_session_id if index_exists?(:events, :huddle_session_id)
      remove_column :events, :huddle_session_id
    end
  end

  def down
    safety_assured do
      add_column :events, :huddle_session_id, :bigint
      add_index :events, :huddle_session_id
      add_foreign_key :events, :huddle_sessions, on_delete: :nullify
    end
  end
end
