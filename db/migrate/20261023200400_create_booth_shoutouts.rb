# frozen_string_literal: true

# A shoutout: a listener's note on a Booth set, optionally pinned to a
# moment in it (`at_seconds`). Shown to every member on the set's page and
# waveform, and sent to the artist as a Nudge (docs/spaces/booth.md,
# Shoutouts).
class CreateBoothShoutouts < ActiveRecord::Migration[8.0]
  def change
    create_table :booth_shoutouts do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :booth_set, null: false, foreign_key: { on_delete: :cascade }
      t.text :body, null: false
      t.integer :at_seconds
      t.timestamps
    end

    add_index :booth_shoutouts, [:booth_set_id, :created_at]
  end
end
