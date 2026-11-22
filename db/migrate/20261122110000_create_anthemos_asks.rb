# frozen_string_literal: true

# Asks from Kronk to Anthemos (docs/spaces/map.md, Asks from Kronk). Kronk
# keeps what it asked, for whom and for how long; the phone is handed only the
# token, fetches the ask with its own sign-in, and signs its answer.
class CreateAnthemosAsks < ActiveRecord::Migration[8.1]
  def change
    create_table :anthemos_asks do |t|
      t.string :token, null: false, index: { unique: true }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :anthemos_link, foreign_key: { on_delete: :nullify }
      t.string :kind, null: false
      t.jsonb :payload, null: false, default: {}
      t.string :status, null: false, default: 'waiting'
      t.string :result
      t.datetime :expires_at, null: false
      t.datetime :answered_at
      t.timestamps
    end
  end
end
