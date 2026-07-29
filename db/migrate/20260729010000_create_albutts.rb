# frozen_string_literal: true

# Albutts — shared-album korner. Three tables:
#
#   albums          — the metadata container (title / description /
#                     cover / owner / visibility / optional event link
#                     / optional feed-projection Status link).
#   album_photos    — one row per contribution. `media_attachment_id`
#                     covers the MVP path (contributor uploads via
#                     Mastodon `POST /api/v1/media`; attribution lives
#                     on the account of the attachment). `external_url`
#                     is the schema-ready future path for
#                     Anthemos-pod-hosted media. A DB-level check
#                     constraint enforces exactly one source per row.
#   album_krews     — join table for `visibility: krew`. Empty in MVP;
#                     wired up in Slice 3 when the Krew composer lands.
#
# See docs/spaces/albutts.md.
#
# Invariants encoded in the schema:
#   - An album's `status_id` (feed projection) is a partial unique
#     index — an album has at most one companion Status, but most
#     rows have none (Slice 2 wires the publisher).
#   - `album_photos.contributor_id` and `album_photos.album_id` FK-
#     cascade so a deleted account + album leaves no orphan rows.
#   - `album_photos.media_attachment_id` FK is `on_delete: nullify`
#     because Mastodon's own vacuum can retire an attachment; the
#     photo row survives but renders dark (matches the spec's
#     one-sided-revocation invariant).
class CreateAlbutts < ActiveRecord::Migration[8.0]
  def change
    create_table :albums do |t|
      t.string  :title, null: false, limit: 240
      t.text    :description
      t.references :owner,
                   null: false,
                   foreign_key: { to_table: :accounts, on_delete: :cascade },
                   index: true
      t.references :cover_media_attachment,
                   null: true,
                   foreign_key: { to_table: :media_attachments, on_delete: :nullify }
      t.integer :visibility, null: false, default: 0
      t.references :event,
                   null: true,
                   foreign_key: { on_delete: :nullify }
      t.references :status,
                   null: true,
                   foreign_key: { on_delete: :nullify },
                   index: { unique: true, where: 'status_id IS NOT NULL', name: 'index_albums_on_status_id_unique' }
      t.timestamps
    end
    add_index :albums, :visibility

    create_table :album_photos do |t|
      t.references :album,
                   null: false,
                   foreign_key: { on_delete: :cascade }
      t.references :contributor,
                   null: false,
                   foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.references :media_attachment,
                   null: true,
                   foreign_key: { on_delete: :nullify }
      t.text :external_url
      t.text :caption
      t.timestamps
      t.index [:album_id, :created_at], name: 'index_album_photos_on_album_and_created_at'
    end
    add_check_constraint :album_photos,
                         '(media_attachment_id IS NOT NULL) <> (external_url IS NOT NULL)',
                         name: 'album_photos_exactly_one_media_source'

    create_table :album_krews do |t|
      t.references :album,
                   null: false,
                   foreign_key: { on_delete: :cascade }
      t.references :krew,
                   null: false,
                   foreign_key: { on_delete: :cascade }
      t.datetime :created_at, null: false, default: -> { 'CURRENT_TIMESTAMP' }
      t.index [:album_id, :krew_id], unique: true, name: 'index_album_krews_on_album_and_krew'
    end
  end
end
