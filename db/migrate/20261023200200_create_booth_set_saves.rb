# frozen_string_literal: true

# A member keeping a set to come back to (My sets → Saved). Private to
# them: nobody else, the set's artist included, sees who saved what.
class CreateBoothSetSaves < ActiveRecord::Migration[8.0]
  def change
    create_table :booth_set_saves do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :booth_set, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :booth_set_saves, [:account_id, :booth_set_id], unique: true
  end
end
