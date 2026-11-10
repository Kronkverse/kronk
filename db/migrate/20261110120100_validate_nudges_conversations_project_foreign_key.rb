# frozen_string_literal: true

class ValidateNudgesConversationsProjectForeignKey < ActiveRecord::Migration[8.1]
  def change
    validate_foreign_key :nudges_conversations, :freethedream_projects, column: :freethedream_project_id
  end
end
