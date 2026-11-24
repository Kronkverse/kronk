# frozen_string_literal: true

# Who a fractal is assigned to (Kommons "Fractals", 2026-11-22): the
# people in the projekt doing that piece of the Komponent.
class CreateFreethedreamAssignments < ActiveRecord::Migration[8.0]
  def change
    create_table :freethedream_assignments do |t|
      t.references :project, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end
    add_index :freethedream_assignments, [:project_id, :account_id], unique: true
  end
end
