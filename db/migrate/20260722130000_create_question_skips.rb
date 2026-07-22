# frozen_string_literal: true

# Kuestions v2 rebuild (Phase 1d — question_skips).
#
# Per-user "not now" tracker for the swipe deck. A skipped Kuestion
# stays locked (viewer never answered) but stops re-surfacing in the
# deck. Client can call an undo endpoint to remove the row.
#
# Composite unique index on (account_id, question_id) — one skip per
# pair, subsequent skip is a no-op.
class CreateQuestionSkips < ActiveRecord::Migration[8.0]
  def change
    create_table :question_skips do |t|
      t.references :account,  null: false, foreign_key: { on_delete: :cascade }
      t.references :question, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :created_at, null: false
    end

    add_index :question_skips, [:account_id, :question_id],
              unique: true,
              name: 'index_question_skips_on_pair'
  end
end
