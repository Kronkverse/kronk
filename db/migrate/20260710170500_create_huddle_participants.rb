# frozen_string_literal: true

# Presence within a huddle session. Rows created on `joined_at` and
# marked with `left_at` on exit; multiple join+leave cycles per person
# per session become multiple rows.
class CreateHuddleParticipants < ActiveRecord::Migration[8.0]
  def change
    create_table :huddle_participants do |t|
      t.references :huddle_session, null: false, foreign_key: { on_delete: :cascade }
      t.references :account,        null: false, foreign_key: { on_delete: :cascade }
      t.datetime   :joined_at, null: false
      t.datetime   :left_at

      t.timestamps
    end

    add_index :huddle_participants, [:huddle_session_id, :account_id, :joined_at],
              name: 'index_huddle_participants_lookup'
  end
end
