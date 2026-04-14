# frozen_string_literal: true

class CreateProposalVotes < ActiveRecord::Migration[8.0]
  def change
    create_table :proposal_votes, force: :cascade do |t|
      t.bigint  :proposal_id, null: false
      t.bigint  :account_id,  null: false
      t.integer :position,    null: false
      t.text    :statement
      t.timestamps null: false
    end

    add_index :proposal_votes, %i(proposal_id account_id), unique: true
    add_index :proposal_votes, :account_id
    add_foreign_key :proposal_votes, :proposals, on_delete: :cascade
    add_foreign_key :proposal_votes, :accounts,  on_delete: :cascade
  end
end
