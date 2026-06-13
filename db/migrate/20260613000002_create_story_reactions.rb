# frozen_string_literal: true

class CreateStoryReactions < ActiveRecord::Migration[8.0]
  def change
    create_table :story_reactions do |t|
      t.bigint :status_id, null: false
      t.bigint :account_id, null: false
      t.string :emoji, null: false, limit: 32
      t.timestamps
    end

    add_index :story_reactions, %i(status_id account_id emoji), unique: true
    add_index :story_reactions, :account_id
    add_foreign_key :story_reactions, :statuses, on_delete: :cascade
    add_foreign_key :story_reactions, :accounts, on_delete: :cascade
  end
end
