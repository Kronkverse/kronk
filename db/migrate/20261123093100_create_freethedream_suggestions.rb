# frozen_string_literal: true

# Someone suggested for a checklist entry (Kommons "Tagging people on a
# checklist item", 2026-11-22: "If i know someone has a generator, i would
# suggest them"): anyone in the projekt suggests someone else in it, and
# they're told. It ends when they take it on or say it's not for them.
class CreateFreethedreamSuggestions < ActiveRecord::Migration[8.0]
  def change
    create_table :freethedream_suggestions do |t|
      t.references :item, null: false, foreign_key: { to_table: :freethedream_items, on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :suggested_by, null: true, foreign_key: { to_table: :accounts, on_delete: :nullify }, index: false
      t.timestamps
    end
    add_index :freethedream_suggestions, [:item_id, :account_id], unique: true
  end
end
