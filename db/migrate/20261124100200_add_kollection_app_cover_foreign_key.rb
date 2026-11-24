# frozen_string_literal: true

# A Kollection app's cover is an upload; it goes when the upload does.
# Added unvalidated, then validated in the next migration (strong_migrations).
class AddKollectionAppCoverForeignKey < ActiveRecord::Migration[8.1]
  def change
    add_foreign_key :kollection_apps, :media_attachments, column: :cover_media_attachment_id, on_delete: :nullify, validate: false
  end
end
