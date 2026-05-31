# frozen_string_literal: true

class CreateMediaTags < ActiveRecord::Migration[7.2]
  def change
    create_table :media_tags do |t|
      t.references :media_attachment, null: false, foreign_key: true, index: false
      t.references :account, null: false, foreign_key: true
      t.references :created_by_account, null: false, foreign_key: { to_table: :accounts }
      t.float :x, null: false, default: 0.5
      t.float :y, null: false, default: 0.5
      t.timestamps
    end

    add_index :media_tags, %i(media_attachment_id account_id), unique: true
  end
end
