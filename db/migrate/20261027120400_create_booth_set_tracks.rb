# frozen_string_literal: true

# An album or EP in the Booth (docs/spaces/booth.md, Albums): several tracks,
# each its own audio file, in order, under one set. Cassidy's Kommons
# proposal "Albums to live in Musik?" (Tal, 2026-10-27).
#
# A track's audio is an ordinary MediaAttachment, like a set's. Deleting one
# a track uses is refused (`on_delete: :restrict`, as for
# `booth_sets.audio_attachment_id`, see `RestrictBoothMediaDeletes`), and
# removing the set takes its tracks with it.
class CreateBoothSetTracks < ActiveRecord::Migration[8.1]
  def change
    create_table :booth_set_tracks do |t|
      t.references :booth_set, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :audio_attachment, null: false, foreign_key: { to_table: :media_attachments, on_delete: :restrict }
      t.integer :position, null: false, default: 0
      t.string :title, null: false
      t.integer :duration_seconds
      t.timestamps
    end

    add_index :booth_set_tracks, [:booth_set_id, :position]
  end
end
