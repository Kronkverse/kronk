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
class AlbuttsStatusBacked < ActiveRecord::Migration[8.0]
  def up
    add_reference :album_photos, :status, foreign_key: { on_delete: :nullify }, null: true

    drop_table :album_photo_froths do |t|
      t.bigint :album_photo_id, null: false
      t.bigint :account_id, null: false
      t.datetime :created_at, null: false
      t.index [:album_photo_id, :account_id], unique: true, name: 'index_album_photo_froths_on_album_photo_id_and_account_id'
      t.index :album_photo_id
      t.index :account_id
    end

    drop_table :album_photo_comments do |t|
      t.bigint :album_photo_id, null: false
      t.bigint :account_id, null: false
      t.bigint :parent_id
      t.text :body, null: false
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false
      t.index :album_photo_id
      t.index :account_id
      t.index :parent_id
    end
  end

  def down
    remove_reference :album_photos, :status, foreign_key: true

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
end
