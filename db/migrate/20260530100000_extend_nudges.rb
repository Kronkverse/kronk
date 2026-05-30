# frozen_string_literal: true

class ExtendNudges < ActiveRecord::Migration[8.0]
  def change
    add_column :nudge_messages, :in_reply_to_notification_id, :bigint
    add_column :nudge_messages, :voice_attachment_id, :bigint
    add_index :nudge_messages, :in_reply_to_notification_id
    add_index :nudge_messages, :voice_attachment_id
    add_foreign_key :nudge_messages, :notifications, column: :in_reply_to_notification_id
    add_foreign_key :nudge_messages, :media_attachments, column: :voice_attachment_id

    create_table :nudge_reactions do |t|
      t.bigint :notification_id, null: false
      t.bigint :account_id, null: false
      t.string :emoji, null: false, limit: 32
      t.timestamps
    end

    add_index :nudge_reactions, [:notification_id, :account_id], unique: true
    add_foreign_key :nudge_reactions, :notifications, on_delete: :cascade
    add_foreign_key :nudge_reactions, :accounts, on_delete: :cascade
  end
end
