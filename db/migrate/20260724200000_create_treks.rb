# frozen_string_literal: true

# Map — Treks. A recorded activity (run/ride/walk/…) a user can keep private
# or publish to their Mates (docs/spaces/map.md, Phase 3).
#
# Privacy invariants encoded here:
# - `route` stores ONLY the privacy-trimmed slice (Kronk::RoutePrivacy trims a
#   radius off each end before write, so the true start/end — usually home —
#   is never persisted). `distance_m` is the FULL length (a stat); the geometry
#   is the trimmed middle. `has_route` is false for hand-entered treks (no
#   geometry at all).
# - No heart-rate / cadence / power / device columns exist — those are
#   discarded at ingest and never stored (Phase 4).
# - `status_id` links the published Status (froth = Favourite, comments =
#   replies); null while a trek is a draft. account FK cascade-deletes.
class CreateTreks < ActiveRecord::Migration[8.0]
  def change
    create_table :treks do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.bigint :status_id
      t.integer :activity_type, null: false, default: 0
      t.integer :state, null: false, default: 0 # draft / published
      t.string :title, null: false, default: ''
      t.string :label
      t.datetime :recorded_at, null: false
      t.integer :distance_m, null: false, default: 0
      t.integer :moving_sec, null: false, default: 0
      t.integer :pace_seconds
      t.float :speed_kmh
      t.integer :elevation_gain
      t.integer :trimmed_m, null: false, default: 0
      t.boolean :has_route, null: false, default: false
      t.jsonb :route # trimmed [ [lng,lat], … ] slice; null for hand-entered
      t.timestamps

      t.index [:account_id, :recorded_at], order: { recorded_at: :desc }, name: 'index_treks_on_account_and_recorded_desc'
      t.index :status_id
    end
  end
end
