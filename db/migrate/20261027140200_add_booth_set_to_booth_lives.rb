# frozen_string_literal: true

# The draft set Kronk makes from a live set's audio recording
# (docs/spaces/booth.md, Recording a live set), so the ended page can link
# to it and the set is made once. Deleting the set leaves the live set.
class AddBoothSetToBoothLives < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :booth_lives, :booth_set_id, :bigint
    add_index :booth_lives, :booth_set_id, algorithm: :concurrently
    # Not validated: the column is new, so every row is empty. New rows are
    # checked.
    add_foreign_key :booth_lives, :booth_sets, on_delete: :nullify, validate: false
  end
end
