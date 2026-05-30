# frozen_string_literal: true

class AddGenresArrayToBoothSets < ActiveRecord::Migration[7.2]
  def change
    add_column :booth_sets, :genres, :string, array: true, default: [], null: false
    safety_assured { remove_column :booth_sets, :genre, :string }
  end
end
