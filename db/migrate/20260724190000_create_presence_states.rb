# frozen_string_literal: true

# Map — presence. One row per account: the caller's opt-in, coarsened
# position on the Map (docs/spaces/map.md). Privacy invariants encoded here:
#
# - One-per-account: unique index on account_id (placing again upserts).
# - `lat`/`lng` store the ALREADY-COARSENED point only — the raw coordinate
#   is never persisted (PresenceState.place! coarsens before write).
# - `expires_at` bounds every share (auto-expire); "remove me" hard-deletes
#   the row — no soft-delete, no location-history table, ever.
# - account FK cascade-deletes: destroy the account, the pin evaporates.
#
# `precision` and `share_scope` are enums (see PresenceState). Nothing
# outside Map touches these rows.
class CreatePresenceStates < ActiveRecord::Migration[8.0]
  def change
    create_table :presence_states do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.float :lat, null: false
      t.float :lng, null: false
      t.integer :precision, null: false, default: 0
      t.integer :share_scope, null: false, default: 0
      t.string :label
      t.datetime :expires_at, null: false
      t.timestamps

      t.index :expires_at
    end
  end
end
