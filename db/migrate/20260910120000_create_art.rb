# frozen_string_literal: true

# Art — single-author korner for physical works (paintings, sculptures,
# prints, drawings, ceramics, photographs). Two tables:
#
#   art_pieces        — the piece itself (title / description / kind /
#                       cover / owner / visibility / optional feed-
#                       projection Status link).
#   art_piece_photos  — one row per photo of the piece. Multiple angles
#                       / details of the same work by the same author,
#                       ordered by `position`. Media rides on the
#                       standard MediaAttachment pipeline (owner
#                       uploads via Mastodon `POST /api/v1/media`);
#                       captions are a plain column on the photo row
#                       — no per-photo Status backing (all photos are
#                       by the piece's owner, so per-photo favourites
#                       / replies would just fragment the surface).
#
# Invariants encoded in the schema:
#   * A piece's `status_id` (feed projection) is a partial unique index —
#     a piece has at most one companion Status, but most rows have none
#     until PublishPiece fires.
#   * `art_piece_photos.art_piece_id` cascades — deleting a piece takes
#     its photo rows with it.
#   * `art_piece_photos.media_attachment_id` FK is `on_delete: nullify`
#     because Mastodon's own vacuum can retire an attachment; the photo
#     row survives but renders dark (matches Albutts's one-sided-
#     revocation invariant for federated media).
class CreateArt < ActiveRecord::Migration[8.0]
  def change
    create_table :art_pieces do |t|
      t.string  :title, null: false, limit: 240
      t.text    :description
      # 0 painting / 1 sculpture / 2 print / 3 drawing / 4 ceramic /
      # 5 photograph / 6 other. Matches ArtPiece#kind enum verbatim.
      t.integer :kind, null: false, default: 0
      t.references :owner,
                   null: false,
                   foreign_key: { to_table: :accounts, on_delete: :cascade },
                   index: true
      t.references :cover_media_attachment,
                   null: true,
                   foreign_key: { to_table: :media_attachments, on_delete: :nullify }
      t.integer :visibility, null: false, default: 0
      t.references :status,
                   null: true,
                   foreign_key: { on_delete: :nullify },
                   index: { unique: true, where: 'status_id IS NOT NULL', name: 'index_art_pieces_on_status_id_unique' }
      t.timestamps
    end
    add_index :art_pieces, :visibility
    add_index :art_pieces, :kind

    create_table :art_piece_photos do |t|
      t.references :art_piece,
                   null: false,
                   foreign_key: { on_delete: :cascade }
      t.references :media_attachment,
                   null: true,
                   foreign_key: { on_delete: :nullify }
      t.text :caption
      t.integer :position, null: false, default: 0
      t.timestamps
      t.index [:art_piece_id, :position], name: 'index_art_piece_photos_on_piece_and_position'
    end
  end
end
