# frozen_string_literal: true

# Albums in progress (docs/spaces/albutts.md, Drafts). The composer uploads
# photos as they're added and saves the whole album here as you go, so
# nothing is lost by navigating away, and several can wait to be finished.
# The GIN index serves the nightly media cleanup, which keeps any upload a
# draft lists (Vacuum::MediaAttachmentsVacuum).
class CreateAlbumDrafts < ActiveRecord::Migration[8.0]
  def change
    create_table :album_drafts do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.jsonb :params, null: false, default: {}
      t.bigint :media_attachment_ids, array: true, null: false, default: []
      t.timestamps
    end

    add_index :album_drafts, :media_attachment_ids, using: :gin
  end
end
