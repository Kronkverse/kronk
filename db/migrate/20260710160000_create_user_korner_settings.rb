# frozen_string_literal: true

# Per-user, per-korner settings blob. Powers the /hub/<slug>/settings
# surface (spec §K). Framework-provided settings (push_enabled) plus
# arbitrary manifest-declared values live under a single jsonb hash
# keyed by setting name.
#
# Absence of a row = defaults everywhere. Presence = at least one
# setting was explicitly written; row is looked up by (user_id, slug)
# and lazily created on first write.
class CreateUserKornerSettings < ActiveRecord::Migration[8.0]
  def change
    create_table :user_korner_settings do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string     :korner_slug, null: false
      t.jsonb      :values, null: false, default: {}
      t.boolean    :push_enabled, null: false, default: true

      t.timestamps
    end

    add_index :user_korner_settings, [:user_id, :korner_slug], unique: true
  end
end
