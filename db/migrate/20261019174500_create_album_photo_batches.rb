# frozen_string_literal: true

# One feed post per burst of photos added to an album (Tal, 2026-10-19;
# docs/spaces/albutts.md, Feed projection). A batch is that post; each photo
# says which batch, if any, it went out in.
class CreateAlbumPhotoBatches < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :album_photo_batches do |t|
      t.references :album, null: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :status, foreign_key: { on_delete: :nullify }, index: { unique: true }
      t.timestamps
    end

    # Nullified by the model when a batch goes (AlbumPhotoBatch has_many
    # :photos, dependent: :nullify); no database key on the photo side.
    add_column :album_photos, :batch_id, :bigint
    add_index :album_photos, :batch_id, algorithm: :concurrently
  end
end
