# frozen_string_literal: true

class ValidateKollectionAppCoverForeignKey < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :kollection_apps, :media_attachments, column: :cover_media_attachment_id
  end
end
