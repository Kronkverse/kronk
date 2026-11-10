# frozen_string_literal: true

# A Krew's, projekt's or Komponent's own Kuddle (docs/spaces/huddle.md,
# A space's own Kuddle): one each, for its members. Nullified, not deleted,
# with its space, so its recordings stay.
class AddSpaceToHuddleSessions < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :huddle_sessions, :krew_id, :bigint
    add_column :huddle_sessions, :freethedream_project_id, :bigint
    add_index :huddle_sessions, :krew_id, unique: true, where: 'krew_id IS NOT NULL', algorithm: :concurrently
    add_index :huddle_sessions, :freethedream_project_id, unique: true, where: 'freethedream_project_id IS NOT NULL',
                                                          name: 'index_huddle_sessions_on_freethedream_project_id', algorithm: :concurrently
    add_foreign_key :huddle_sessions, :krews, on_delete: :nullify, validate: false
    add_foreign_key :huddle_sessions, :freethedream_projects, column: :freethedream_project_id, on_delete: :nullify, validate: false
  end
end
