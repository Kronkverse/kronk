# frozen_string_literal: true

# A project's cover photo, shown at the top of its Overview
# (docs/spaces/freethedream.md, "The Overview"). The date and place of an
# in-person project now come from its linked Kalendar event, so
# `starts_on` and `location` are no longer read (ignored on the model;
# drop them in a later migration).
class AddCoverToFreethedreamProjects < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :freethedream_projects, :cover_media_attachment_id, :bigint
    add_index :freethedream_projects, :cover_media_attachment_id, algorithm: :concurrently
    safety_assured { add_foreign_key :freethedream_projects, :media_attachments, column: :cover_media_attachment_id, on_delete: :nullify }
  end
end
