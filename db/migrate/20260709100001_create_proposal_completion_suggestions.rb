# frozen_string_literal: true

class CreateProposalCompletionSuggestions < ActiveRecord::Migration[8.0]
  def change
    create_table :proposal_completion_suggestions do |t|
      t.references :proposal, null: false, foreign_key: { on_delete: :cascade }
      t.references :account,  null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :proposal_completion_suggestions,
              [:proposal_id, :account_id],
              unique: true,
              name: 'index_proposal_completion_suggestions_unique'
  end
end
