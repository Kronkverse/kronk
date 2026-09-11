# frozen_string_literal: true

# Cinema — single-author korner for short films. One table:
#
#   films — title / description / video (a MediaAttachment) / owner /
#           visibility / optional feed-projection Status link.
#
# Video rides Mastodon's shared MediaAttachment pipeline (owner uploads
# via `POST /api/v1/media`, then references the returned id when
# creating the film). No transcoding — the uploaded MP4 is served
# straight through the media pipeline and played back via a plain
# <video> element in the reader.
#
# Invariants encoded in the schema:
#   * A film's `status_id` (feed projection) is a partial unique index
#     — one companion Status per film, but most rows have none until
#     PublishFilm fires.
#   * `films.video_media_attachment_id` FK is `on_delete: nullify`
#     because Mastodon's own vacuum can retire an attachment; the film
#     row survives but renders dark (matches the pattern Albutts uses
#     for its federated media).
class CreateCinema < ActiveRecord::Migration[8.0]
  def change
    create_table :films do |t|
      t.string  :title, null: false, limit: 240
      t.text    :description
      t.references :owner,
                   null: false,
                   foreign_key: { to_table: :accounts, on_delete: :cascade },
                   index: true
      t.references :video_media_attachment,
                   null: true,
                   foreign_key: { to_table: :media_attachments, on_delete: :nullify }
      t.integer :visibility, null: false, default: 0
      t.references :status,
                   null: true,
                   foreign_key: { on_delete: :nullify },
                   index: { unique: true, where: 'status_id IS NOT NULL', name: 'index_films_on_status_id_unique' }
      t.timestamps
    end
    add_index :films, :visibility
  end
end
