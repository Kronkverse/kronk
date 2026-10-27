# frozen_string_literal: true

# A recording can be a video or an audio file (docs/spaces/huddle.md,
# Recordings). The recorder uploads both from one recording of a live set,
# and `pair_id` links each to the other. Rows from before are videos.
class AddMediaToCallRecordings < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :call_recordings, :media, :string, null: false, default: 'video'
    add_column :call_recordings, :pair_id, :bigint
    add_index :call_recordings, :pair_id, algorithm: :concurrently
    # Not validated: the column is new, so every row is empty. New rows are
    # checked.
    add_foreign_key :call_recordings, :call_recordings, column: :pair_id, on_delete: :nullify, validate: false
  end
end
