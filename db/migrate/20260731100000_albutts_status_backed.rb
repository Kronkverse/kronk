# frozen_string_literal: true

# Albutts photos become Status-backed: each `AlbumPhoto` links to a
# `Status` that carries the caption, media, favourites, and replies.
# The parallel `album_photo_froths` + `album_photo_comments` tables
# retire in the same migration — favourites move to the shared
# `favourites` table, replies to the standard reply thread. The album
# itself already had `status_id` (the feed-card announcement); this
# adds the same shape at the photo level.
#
# Safe to drop the two child tables in one shot: AlbumPhoto shipped
# on 2026-07-29 to the shadow line only, so no production rows depend
# on them.
#
# Structured to satisfy `strong_migrations`:
#   * `add_column` + a separate concurrent index instead of the
#     `add_reference` shortcut that combines both under a table lock.
#   * `disable_ddl_transaction!` so the concurrent index can run.
#   * The FK is deliberately omitted for the same reason the sibling
#     migration `AddStatusIdToProposals` omits it — the column is a
#     soft link (`on_delete: :nullify` at the application layer via
#     `has_one :album_photo, dependent: :nullify` on Status).
#   * `drop_table` is a destructive DDL, wrapped in `safety_assured`
#     with the explicit context: shadow-only, two-day-old tables,
#     the models + their controllers + routes + client code paths all
#     drop in the same PR.
class AlbuttsStatusBacked < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :album_photos, :status_id, :bigint, if_not_exists: true

    add_index :album_photos, :status_id,
              algorithm: :concurrently,
              where: 'status_id IS NOT NULL',
              if_not_exists: true

    safety_assured do
      drop_table :album_photo_froths, if_exists: true
      drop_table :album_photo_comments, if_exists: true
    end
  end

  def down
    safety_assured do
      create_table :album_photo_froths do |t|
        t.references :album_photo, null: false, foreign_key: true, index: false
        t.references :account, null: false, foreign_key: true
        t.datetime :created_at, null: false
        t.index [:album_photo_id, :account_id], unique: true, name: 'index_album_photo_froths_on_album_photo_id_and_account_id'
        t.index :album_photo_id
      end

      create_table :album_photo_comments do |t|
        t.references :album_photo, null: false, foreign_key: true
        t.references :account, null: false, foreign_key: true
        t.references :parent, foreign_key: { to_table: :album_photo_comments }
        t.text :body, null: false
        t.timestamps
      end
    end

    remove_index :album_photos, :status_id, algorithm: :concurrently, if_exists: true
    remove_column :album_photos, :status_id, if_exists: true
  end
end
