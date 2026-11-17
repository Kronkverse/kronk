# frozen_string_literal: true

# A shoutout on an album can be pinned to a moment in one of its tracks
# (docs/spaces/booth.md, Shoutouts). Taking the track off the album keeps
# the shoutout, unpinned.
class AddTrackToBoothShoutouts < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :booth_shoutouts, :booth_set_track, null: true, index: { algorithm: :concurrently }
    add_foreign_key :booth_shoutouts, :booth_set_tracks, on_delete: :nullify, validate: false
  end
end
