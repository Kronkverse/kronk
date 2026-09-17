# frozen_string_literal: true

# Phase 5b — retires the `booth_sets.event_id` FK column now that the
# Kalendar → Booth link lives on `korner_attachments` and every reader
# has migrated (docs/kronk_korner_attachments.md §5).
#
# The Phase 3 backfill (20260814225459) copied every populated row
# into `korner_attachments` as `(kalendar, booth, link)`. This PR
# also retires the composer's "attach event" UI (EventCombobox), the
# controller param, the serializer attribute, and the model
# association. The one path readers had into the FK is gone.
#
# UX shift: booth uploaders can no longer pick an existing event at
# create time. The link is now created from the event side via
# `<AttachmentPicker>` (Phase 4). Booth sets keep their free-text
# `event_name` + `event_date` fields for standalone context.
#
# Rollback: re-adds the column + index + FK but does not backfill
# values. If a rollback is needed, backfill from `korner_attachments`
# after the schema is restored:
#
#   UPDATE booth_sets b SET event_id = ka.source_id
#   FROM korner_attachments ka
#   WHERE ka.source_slug = 'kalendar'
#     AND ka.target_slug = 'booth'
#     AND ka.target_id = b.id
#     AND ka.kind = 'link';
class DropBoothSetsEventId < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      remove_foreign_key :booth_sets, :events if foreign_key_exists?(:booth_sets, :events)
      remove_index :booth_sets, :event_id if index_exists?(:booth_sets, :event_id)
      remove_column :booth_sets, :event_id
    end
  end

  def down
    safety_assured do
      add_column :booth_sets, :event_id, :bigint
      add_index :booth_sets, :event_id
      add_foreign_key :booth_sets, :events
    end
  end
end
