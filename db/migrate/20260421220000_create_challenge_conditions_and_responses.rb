# frozen_string_literal: true

class CreateChallengeConditionsAndResponses < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      create_table :challenge_conditions do |t|
        t.bigint   :proposal_vote_id, null: false
        t.text     :text,             null: false
        t.datetime :met_at
        t.timestamps null: false
      end

      add_index :challenge_conditions, :proposal_vote_id
      add_foreign_key :challenge_conditions, :proposal_votes, on_delete: :cascade, validate: false

      create_table :challenge_responses do |t|
        t.bigint :challenge_condition_id, null: false
        t.bigint :account_id,             null: false
        t.text   :body,                   null: false
        t.timestamps null: false
      end

      add_index :challenge_responses, :challenge_condition_id
      add_index :challenge_responses, :account_id
      add_foreign_key :challenge_responses, :challenge_conditions, on_delete: :cascade, validate: false
      add_foreign_key :challenge_responses, :accounts,             on_delete: :cascade, validate: false
    end
  end
end
