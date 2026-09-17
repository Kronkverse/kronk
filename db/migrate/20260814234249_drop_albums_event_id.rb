# frozen_string_literal: true

# Retires the `albums.event_id` FK column now that the Kalendar →
# Albutts link lives in `korner_attachments` and every reader has
# migrated (docs/kronk_korner_attachments.md Phase 5).
#
# The backfill migration (20260814225459) already copied every
# populated row into `korner_attachments` as
# `(kalendar, albutts, spawn)`; the Phase 3 factory + `AttachmentSource`
# concern (2026-08-14) took over both the create-time write and the
# destroy-time cascade, so this column has been passive for a release
# cycle. Dropping it now.
#
# Rollback: re-adds the column + index but does not backfill values.
# If a rollback is needed, backfill from `korner_attachments` after
# the schema is restored:
#
#   UPDATE albums a SET event_id = ka.source_id
#   FROM korner_attachments ka
#   WHERE ka.source_slug = 'kalendar'
#     AND ka.target_slug = 'albutts'
#     AND ka.target_id = a.id
#     AND ka.kind = 'spawn';
class DropAlbumsEventId < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      remove_foreign_key :albums, :events if foreign_key_exists?(:albums, :events)
      remove_index :albums, :event_id if index_exists?(:albums, :event_id)
      remove_column :albums, :event_id
    end
  end

  def down
    safety_assured do
      add_column :albums, :event_id, :bigint
      add_index :albums, :event_id
      add_foreign_key :albums, :events, on_delete: :nullify
    end
  end
end
