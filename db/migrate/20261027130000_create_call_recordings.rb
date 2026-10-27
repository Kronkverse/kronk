# frozen_string_literal: true

# Recordings of Kronk's calls (docs/spaces/huddle.md, Recordings; Tal,
# 2026-10-27). The one thing a call leaves behind. A row per file the
# recorder uploads: what it belongs to (`kind`: the Main Huddle, a Kuddle or a
# Booth live set, and that record), where it sits (`storage_key`, a private
# object in the app's bucket), and whether the upload finished. The file is
# never public: it is played through short-lived signed URLs.
#
# Deleting a Kuddle or a live set at the database (an account's deletion
# cascades to both) takes its rows too; deleting through the model also
# deletes the object (CallRecording).
class CreateCallRecordings < ActiveRecord::Migration[8.0]
  def change
    create_table :call_recordings do |t|
      t.string :kind, null: false
      t.references :huddle_session, foreign_key: { on_delete: :cascade }
      t.references :booth_live, foreign_key: { on_delete: :cascade }
      t.references :started_by_account, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.string :status, null: false, default: 'pending'
      t.string :storage_key, null: false
      t.string :filename, null: false
      t.string :content_type, null: false
      t.bigint :size, null: false
      t.integer :duration
      t.datetime :completed_at
      t.timestamps
    end
    add_index :call_recordings, :storage_key, unique: true
    add_index :call_recordings, [:kind, :status, :created_at]
  end
end
