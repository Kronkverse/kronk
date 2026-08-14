# frozen_string_literal: true

# Kronk::KornerAttachment — one join table for every cross-korner connection.
# Replaces the per-pair FK column + bespoke subscriber pattern (album.event_id,
# booth_set.event_id, event.spawn_album, albutts_event_bus.rb). Keyed by
# manifest slug + record id — the manifest is already the registry, so
# reuse it as the primary key of the join. Spec: docs/kronk_korner_attachments.md.
#
# Uniqueness includes `kind` so the same two records can carry both a `spawn`
# (framework-created) and a later user-added `link` attachment without
# collision — spec §2.1.
class CreateKornerAttachments < ActiveRecord::Migration[8.0]
  def change
    create_table :korner_attachments do |t|
      t.string  :source_slug, null: false
      t.bigint  :source_id,   null: false
      t.string  :target_slug, null: false
      t.bigint  :target_id,   null: false
      t.string  :kind,        null: false
      t.jsonb   :metadata
      t.references :created_by_account, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.timestamps
    end

    add_index :korner_attachments, %i(source_slug source_id),
              name: 'index_korner_attachments_on_source'
    add_index :korner_attachments, %i(target_slug target_id),
              name: 'index_korner_attachments_on_target'
    add_index :korner_attachments, %i(source_slug source_id target_slug target_id kind),
              unique: true,
              name: 'index_korner_attachments_on_endpoints_and_kind'
  end
end
