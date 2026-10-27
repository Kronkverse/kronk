# frozen_string_literal: true

# A recording can be a video or an audio file (docs/spaces/huddle.md,
# Recordings). The recorder uploads both from one recording of a live set,
# and `pair_id` links each to the other. Rows from before are videos.
class AddMediaToCallRecordings < ActiveRecord::Migration[8.0]
  def change
    add_column :call_recordings, :media, :string, null: false, default: 'video'
    add_reference :call_recordings, :pair, foreign_key: { to_table: :call_recordings, on_delete: :nullify }
  end
end
