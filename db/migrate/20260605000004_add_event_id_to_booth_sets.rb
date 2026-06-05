# frozen_string_literal: true

class AddEventIdToBoothSets < ActiveRecord::Migration[7.2]
  def change
    add_reference :booth_sets, :event, null: true, foreign_key: false
    add_foreign_key :booth_sets, :events, validate: false
  end
end
