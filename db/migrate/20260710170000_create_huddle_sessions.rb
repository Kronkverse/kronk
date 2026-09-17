# frozen_string_literal: true

# Huddle becomes its own korner in 2.0.0 (Tal's decision, delta rollup
# I4): separate models, own /hub/huddle URL space, own settings space,
# but peer-connected to Kalendar via events.huddle_session_id when a
# Kalendar event IS a gathering on a Huddle.
#
# Fields carry over from `events` where Huddle rides today:
#   title             ← events.title
#   description       ← events.description
#   session_url       ← events.huddle_url
#   scheduled_start   ← events.start_time  (optional; huddles can be spontaneous)
#   scheduled_end     ← events.end_time    (optional)
#   host_account_id   ← events.account_id  (Huddle's creator)
class CreateHuddleSessions < ActiveRecord::Migration[8.0]
  def change
    create_table :huddle_sessions do |t|
      t.string     :title, null: false, limit: 200
      t.text       :description
      t.references :host_account, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.bigint     :status_id
      t.string     :session_url, null: false, limit: 400
      t.datetime   :scheduled_start
      t.datetime   :scheduled_end
      t.string     :state, default: 'draft', null: false
      t.datetime   :ended_at

      t.timestamps
    end

    add_index :huddle_sessions, :status_id, unique: true, where: 'status_id IS NOT NULL'
    add_index :huddle_sessions, :state
    add_index :huddle_sessions, :scheduled_start, where: 'scheduled_start IS NOT NULL'
  end
end
