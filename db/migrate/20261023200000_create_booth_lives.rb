# frozen_string_literal: true

# A live set in the Booth: a musician playing to members in real time, on
# the same Jitsi server Huddle uses (docs/spaces/booth.md, Live sets).
# `room_key` names the Jitsi room. Nothing of the performance is stored;
# the host can upload a recording afterwards as an ordinary set.
class CreateBoothLives < ActiveRecord::Migration[8.0]
  def change
    create_table :booth_lives do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false
      t.text :description, null: false, default: ''
      t.string :genres, array: true, null: false, default: []
      t.string :room_key, null: false
      t.datetime :starts_at, null: false
      t.datetime :started_at
      t.datetime :ended_at
      t.bigint :status_id
      t.timestamps
    end

    add_index :booth_lives, :room_key, unique: true
    add_index :booth_lives, :starts_at
  end
end
