# frozen_string_literal: true

class AddEventIdToBoothSets < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :booth_sets, :event, null: true, foreign_key: false, index: { algorithm: :concurrently }
    add_foreign_key :booth_sets, :events, validate: false
  end
end
