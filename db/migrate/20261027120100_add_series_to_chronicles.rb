# frozen_string_literal: true

# A Kronikle can be a chapter of one Series: `series_id`, and its place in
# it, `series_position` (1, 2, 3… in reading order; null when it is in no
# Series). Deleting a Series keeps its Kronikles: the key clears, and
# ChronicleSeries clears the positions before it goes.
class AddSeriesToChronicles < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :chronicles, :series_id, :bigint
    add_column :chronicles, :series_position, :integer
    add_index :chronicles, [:series_id, :series_position], algorithm: :concurrently
    # Not validated: the column is new, so every row is empty. New rows are
    # checked.
    add_foreign_key :chronicles, :chronicle_series, column: :series_id, on_delete: :nullify, validate: false
  end
end
