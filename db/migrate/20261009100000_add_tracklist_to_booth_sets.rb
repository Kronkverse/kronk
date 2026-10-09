# frozen_string_literal: true

# The Booth: an optional track list per set (Kommons proposal
# 116651831854514343, "...have comments and track listings too"). An ordered
# jsonb array of `{ start_seconds, artist, title }` entries, validated on the
# model (BoothSet::TRACKLIST_MAX). A constant default on a new column is a
# metadata-only change in Postgres 11+, so no backfill and no table rewrite.
class AddTracklistToBoothSets < ActiveRecord::Migration[8.0]
  def change
    add_column :booth_sets, :tracklist, :jsonb, default: [], null: false
  end
end
