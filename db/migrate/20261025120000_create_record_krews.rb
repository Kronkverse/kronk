# frozen_string_literal: true

# The Krews a film, kar, kronikle, art piece or listing is for, on top of its
# reach tier (Kronk::KrewAudience, decisions.md 2026-10-25). One table for
# every korner without a Krew column of its own, keyed like a Konnection:
# the korner's slug and the record's id.
class CreateRecordKrews < ActiveRecord::Migration[8.0]
  def change
    create_table :record_krews do |t|
      t.string :korner_slug, null: false
      t.bigint :record_id, null: false
      t.references :krew, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end
    add_index :record_krews, [:korner_slug, :record_id, :krew_id], unique: true, name: 'index_record_krews_on_record_and_krew'
  end
end
