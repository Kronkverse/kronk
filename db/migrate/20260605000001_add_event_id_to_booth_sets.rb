# frozen_string_literal: true

class AddEventIdToBoothSets < ActiveRecord::Migration[7.2]
  def change
    add_reference :booth_sets, :event, foreign_key: true, null: true
  end
end
