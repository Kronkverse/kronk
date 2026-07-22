# frozen_string_literal: true

# Comments on a Kommons proposal — the discussion surface for the support-model
# proposal page (docs/spaces/kommons_proposal_page.md). One level of threading:
# a comment optionally replies to another (`parent_id`). New table, so the
# references + indexes are safe to add non-concurrently.
class CreateProposalComments < ActiveRecord::Migration[8.0]
  def change
    create_table :proposal_comments do |t|
      t.references :proposal, null: false, foreign_key: true
      t.references :account, null: false, foreign_key: true
      t.references :parent, null: true,
                            foreign_key: { to_table: :proposal_comments }
      t.text :body, null: false

      t.timestamps
    end
  end
end
