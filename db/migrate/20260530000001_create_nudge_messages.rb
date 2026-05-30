# frozen_string_literal: true

class CreateNudgeMessages < ActiveRecord::Migration[7.2]
  def change
    create_table :nudge_messages do |t|
      t.references :notification, null: false, foreign_key: true
      t.text :body
      t.bigint :media_attachment_id

      t.timestamps
    end

    add_index :nudge_messages, :media_attachment_id
  end
end
