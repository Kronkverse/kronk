# frozen_string_literal: true

# The `album_photos_exactly_one_media_source` check constraint dates from the
# original Albutts table (20260729010000) and required exactly one of
# `media_attachment_id` / `external_url` to be set. AlbumPhoto was refactored on
# 2026-07-31 to be a thin Status-backed join — new rows carry `status_id` and
# set NEITHER legacy media column, so every insert now violates the constraint
# (both NULL -> `false <> false` -> fails), 500ing every photo upload. Drop the
# obsolete constraint; the legacy columns themselves are left for a follow-up
# cleanup (the model already ignores them).
class DropAlbumPhotosMediaSourceConstraint < ActiveRecord::Migration[8.0]
  def up
    remove_check_constraint :album_photos, name: 'album_photos_exactly_one_media_source'
  end

  def down
    add_check_constraint :album_photos,
                         '(media_attachment_id IS NOT NULL) <> (external_url IS NOT NULL)',
                         name: 'album_photos_exactly_one_media_source',
                         validate: false
  end
end
