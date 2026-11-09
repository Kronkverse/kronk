# frozen_string_literal: true

# A projekt's own chat in Nudges (docs/spaces/freethedream.md, Chat): a
# group conversation like a Krew's, one per projekt.
class AddFreethedreamProjectToNudgesConversations < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :nudges_conversations, :freethedream_project_id, :bigint
    add_index :nudges_conversations, :freethedream_project_id,
              unique: true, where: 'freethedream_project_id IS NOT NULL',
              name: 'index_nudges_convos_on_freethedream_project_id', algorithm: :concurrently
    add_foreign_key :nudges_conversations, :freethedream_projects, column: :freethedream_project_id, on_delete: :cascade, validate: false
  end
end
