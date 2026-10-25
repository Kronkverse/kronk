# frozen_string_literal: true

# "Remind me" on a scheduled live set: a Nudge when the host goes live.
class CreateBoothLiveReminders < ActiveRecord::Migration[8.0]
  def change
    create_table :booth_live_reminders do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :booth_live, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :booth_live_reminders, [:account_id, :booth_live_id], unique: true
  end
end
