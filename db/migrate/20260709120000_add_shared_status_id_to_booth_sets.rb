# frozen_string_literal: true

class AddSharedStatusIdToBoothSets < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :booth_sets,
                  :shared_status,
                  null: true,
                  index: { unique: true, algorithm: :concurrently }
  end
end
