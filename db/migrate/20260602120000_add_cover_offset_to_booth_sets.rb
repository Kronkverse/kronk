# frozen_string_literal: true

class AddCoverOffsetToBoothSets < ActiveRecord::Migration[7.2]
  def change
    add_column :booth_sets, :cover_offset_y, :integer, default: 50, null: false
  end
end
