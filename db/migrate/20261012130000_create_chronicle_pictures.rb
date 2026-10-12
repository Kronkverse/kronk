# frozen_string_literal: true

# Pictures placed between the paragraphs of a Kronikle (Tal 2026-10-12,
# Kommons proposal "adding different font sizing + layout images"). The body
# names each one as `![caption](picture:<media id>)`; this table is what
# says the media belongs to the Kronikle, so the orphaned-media sweep leaves
# it alone.
class CreateChroniclePictures < ActiveRecord::Migration[8.0]
  def change
    create_table :chronicle_pictures do |t|
      t.references :chronicle, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :media_attachment, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :chronicle_pictures, [:chronicle_id, :media_attachment_id], unique: true
  end
end
