# frozen_string_literal: true

# Kuestions v2 rebuild (Phase 1a — schema for answer formats).
#
# The asker picks how people answer: `text` (free-text), `mc`
# (multiple choice, 2–4 options), or `yn` (yes/no). MC options live
# on the Question as a jsonb array `[{"label" => "..."}]`; per-answer
# choice is recorded on Answer#choice_index. Backfills every existing
# row to `text` so the prior model (all free-text) keeps working.
class AddAnswerFormatToQuestions < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :questions, :answer_format, :string, null: false, default: 'text'
      add_column :questions, :mc_options, :jsonb, null: false, default: []
      add_column :answers,   :choice_index, :integer

      # Partial index — tiny (only non-`text` rows). Non-concurrent is fine on
      # this small table; `safety_assured` clears the strong_migrations gate
      # that was aborting the deploy.
      add_index :questions, :answer_format, where: "answer_format <> 'text'", name: 'index_questions_on_answer_format_nontext'
    end
  end
end
