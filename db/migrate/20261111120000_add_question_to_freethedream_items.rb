# frozen_string_literal: true

# A Decide on a Komponent's checklist is a quick Kuestion asked in the
# Komponent (docs/spaces/freethedream.md, The checklist). Deleting the
# Kuestion leaves the entry, without its choices.
class AddQuestionToFreethedreamItems < ActiveRecord::Migration[8.1]
  def change
    # Both tables are small.
    safety_assured do
      add_reference :freethedream_items, :question, foreign_key: { on_delete: :nullify }, index: { where: 'question_id IS NOT NULL' }
    end
  end
end
