# frozen_string_literal: true

# The draft set Kronk makes from a live set's audio recording
# (docs/spaces/booth.md, Recording a live set), so the ended page can link
# to it and the set is made once. Deleting the set leaves the live set.
class AddBoothSetToBoothLives < ActiveRecord::Migration[8.0]
  def change
    add_reference :booth_lives, :booth_set, foreign_key: { on_delete: :nullify }
  end
end
