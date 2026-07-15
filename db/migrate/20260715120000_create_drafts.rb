# frozen_string_literal: true

# Composer autosave — one rolling draft per account. The web composer PUTs its
# state here (debounced) so in-progress posts survive navigating away, a
# refresh, or a device switch. Mirrors scheduled_statuses (params jsonb + media
# referenced by id) without the schedule. New table, so the unique index is
# created inline (no strong_migrations concern).
class CreateDrafts < ActiveRecord::Migration[8.0]
  def change
    create_table :drafts do |t|
      t.belongs_to :account, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.jsonb :params, null: false, default: {}
      t.bigint :media_attachment_ids, array: true, null: false, default: []

      t.timestamps
    end
  end
end
