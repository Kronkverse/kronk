# frozen_string_literal: true

# Kuestions v2 — dedicated Answer model. One answer per (question,
# account) — enforced by unique index. Each answer optionally has its
# own status_id for feed presence (§5.5). The answer-before-view gate
# lives in Kuestions::VisibilityGate; this schema just makes the shape
# uniqueness-safe.
class CreateAnswers < ActiveRecord::Migration[8.0]
  def change
    create_table :answers do |t|
      t.references :question, null: false, foreign_key: { on_delete: :cascade }
      t.references :account,  null: false, foreign_key: { on_delete: :cascade }
      t.text       :body,     null: false
      t.bigint     :status_id

      t.timestamps
    end

    add_index :answers, [:question_id, :account_id], unique: true
    add_index :answers, :status_id, unique: true, where: 'status_id IS NOT NULL'
  end
end
