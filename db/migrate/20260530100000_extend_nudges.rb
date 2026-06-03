# frozen_string_literal: true

class ExtendNudges < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :nudge_messages, :in_reply_to_notification_id, :bigint, if_not_exists: true
    add_column :nudge_messages, :voice_attachment_id, :bigint, if_not_exists: true
    add_index :nudge_messages, :in_reply_to_notification_id, algorithm: :concurrently, if_not_exists: true
    add_index :nudge_messages, :voice_attachment_id, algorithm: :concurrently, if_not_exists: true
    unless foreign_key_exists?(:nudge_messages, :notifications, column: :in_reply_to_notification_id)
      add_foreign_key :nudge_messages, :notifications, column: :in_reply_to_notification_id, validate: false
    end
    unless foreign_key_exists?(:nudge_messages, :media_attachments, column: :voice_attachment_id)
      add_foreign_key :nudge_messages, :media_attachments, column: :voice_attachment_id, validate: false
    end

    create_table :nudge_reactions, if_not_exists: true do |t|
      t.bigint :notification_id, null: false
      t.bigint :account_id, null: false
      t.string :emoji, null: false, limit: 32
      t.timestamps
    end

    add_index :nudge_reactions, [:notification_id, :account_id], unique: true, algorithm: :concurrently, if_not_exists: true
    unless foreign_key_exists?(:nudge_reactions, :notifications)
      add_foreign_key :nudge_reactions, :notifications, on_delete: :cascade, validate: false
    end
    unless foreign_key_exists?(:nudge_reactions, :accounts)
      add_foreign_key :nudge_reactions, :accounts, on_delete: :cascade, validate: false
    end
  end
end
