# frozen_string_literal: true

# Kuestions v2 rebuild (Phase 1c — Answer edit history).
#
# Every edit is preserved as accessible history, visible to anyone who
# can view the answer. Prior body + choice_index snapshotted into
# `edit_history` jsonb at update time.
class AddEditHistoryToAnswers < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :answers, :edit_history, :jsonb, null: false, default: []
    end
  end
end
