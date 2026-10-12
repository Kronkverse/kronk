# frozen_string_literal: true

# People who have joined a claimed proposal alongside the dev who claimed it
# (Tal 2026-10-12, Kommons proposal "'Claim' button visibility"). The claimant
# stays on `proposals.claimed_by_account_id`; this holds everyone else.
class CreateProposalJoins < ActiveRecord::Migration[8.0]
  def change
    create_table :proposal_joins do |t|
      t.references :proposal, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :proposal_joins, [:proposal_id, :account_id], unique: true
  end
end
