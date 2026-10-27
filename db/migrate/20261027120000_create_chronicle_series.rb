# frozen_string_literal: true

# A Kronikles Series (Kommons proposal "Kronikles", 117504092528767330;
# docs/spaces/kronikles.md, Series): one writer's Kronikles gathered as
# ordered chapters under a title, with an optional description and cover.
#
# A Series has no audience of its own. Each chapter keeps its own, and the
# Series is seen as far as its chapters are (ChronicleSeries.visible_to).
# The cover is one of the owner's own uploads, held by id like an art
# piece's (`owns_uploads`), and kept out of the orphaned-media sweep
# (Vacuum::MediaAttachmentsVacuum::KEEPERS).
class CreateChronicleSeries < ActiveRecord::Migration[8.0]
  def change
    create_table :chronicle_series do |t|
      t.references :owner, null: false, index: true, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.string :title, null: false, limit: 240
      t.text :description, null: false, default: ''
      t.references :cover_media_attachment, null: true, index: true, foreign_key: { to_table: :media_attachments, on_delete: :nullify }
      t.timestamps
    end
  end
end
