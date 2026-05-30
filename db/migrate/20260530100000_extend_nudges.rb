# frozen_string_literal: true

class ExtendNudges < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :nudge_messages, :in_reply_to_notification_id, :bigint unless column_exists?(:nudge_messages, :in_reply_to_notification_id)
    add_column :nudge_messages, :voice_attachment_id, :bigint unless column_exists?(:nudge_messages, :voice_attachment_id)

    safety_assured do
      add_index :nudge_messages, :in_reply_to_notification_id unless index_exists?(:nudge_messages, :in_reply_to_notification_id)
      add_index :nudge_messages, :voice_attachment_id unless index_exists?(:nudge_messages, :voice_attachment_id)
    end

    add_foreign_key :nudge_messages, :notifications, column: :in_reply_to_notification_id unless foreign_key_exists?(:nudge_messages, column: :in_reply_to_notification_id)
    add_foreign_key :nudge_messages, :media_attachments, column: :voice_attachment_id unless foreign_key_exists?(:nudge_messages, column: :voice_attachment_id)

    unless table_exists?(:nudge_reactions)
      create_table :nudge_reactions do |t|
        t.bigint :notification_id, null: false
        t.bigint :account_id, null: false
        t.string :emoji, null: false, limit: 32
        t.timestamps
      end

      safety_assured do
        add_index :nudge_reactions, %i(notification_id account_id), unique: true
      end
      add_foreign_key :nudge_reactions, :notifications, on_delete: :cascade
      add_foreign_key :nudge_reactions, :accounts, on_delete: :cascade
    end
  end
end
