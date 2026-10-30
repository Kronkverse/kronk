# frozen_string_literal: true

# Joining a Komponent (a gang in the code; Tal, 2026-10-30): someone in a
# projekt joins one Komponent to hear about it, its talk and what's added
# to it. Removing the Komponent or the account removes the row.
class CreateFreethedreamGangMembers < ActiveRecord::Migration[8.0]
  def change
    create_table :freethedream_gang_members do |t|
      t.references :project, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end
    add_index :freethedream_gang_members, [:project_id, :account_id], unique: true
  end
end
