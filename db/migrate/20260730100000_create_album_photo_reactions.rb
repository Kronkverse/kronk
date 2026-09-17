# frozen_string_literal: true

# Albutts — per-photo reactions.
#
#   * `album_photo_froths` — one row per (photo, account); toggled by the
#     Froth button in the lightbox. Uniqueness enforced by index.
#   * `album_photo_comments` — one row per comment; one level of
#     threading via `parent_id` (mirrors ProposalComment).
#
# Both cascade with their parent photo (dependent: :destroy on the model)
# and with the album via the photos FK.
class CreateAlbumPhotoReactions < ActiveRecord::Migration[8.0]
  def change
    create_table :album_photo_froths do |t|
      t.references :album_photo, null: false, foreign_key: true
      t.references :account,     null: false, foreign_key: true
      t.datetime   :created_at,  null: false
    end

    add_index :album_photo_froths, %i(album_photo_id account_id), unique: true

    create_table :album_photo_comments do |t|
      t.references :album_photo, null: false, foreign_key: true
      t.references :account,     null: false, foreign_key: true
      t.references :parent, null: true,
                            foreign_key: { to_table: :album_photo_comments }
      t.text :body, null: false

      t.timestamps
    end
  end
end
