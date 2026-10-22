# frozen_string_literal: true

# When each person last opened a Kuestion's answers, so the Answered list
# can count the answers that came in since (Kuestions, "new answers").
class CreateQuestionSeenMarkers < ActiveRecord::Migration[8.1]
  def change
    create_table :question_seen_markers do |t|
      t.references :account,  null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :question, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :seen_at, null: false
      t.timestamps
    end

    add_index :question_seen_markers, [:account_id, :question_id],
              unique: true,
              name: 'index_question_seen_markers_on_pair'
  end
end
