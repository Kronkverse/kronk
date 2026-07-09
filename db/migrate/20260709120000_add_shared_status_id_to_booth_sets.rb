# frozen_string_literal: true

class AddSharedStatusIdToBoothSets < ActiveRecord::Migration[8.0]
  def change
    add_reference :booth_sets,
                  :shared_status,
                  foreign_key: { to_table: :statuses, on_delete: :nullify },
                  null: true,
                  index: { unique: true }
  end
end
