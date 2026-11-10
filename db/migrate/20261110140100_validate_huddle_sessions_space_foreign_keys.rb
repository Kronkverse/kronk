# frozen_string_literal: true

class ValidateHuddleSessionsSpaceForeignKeys < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :huddle_sessions, :krews
    validate_foreign_key :huddle_sessions, :freethedream_projects, column: :freethedream_project_id
  end
end
