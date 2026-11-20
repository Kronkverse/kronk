# frozen_string_literal: true

# Kronk — Mateship. What one Mate's posts reach your feed: a row means you
# don't see that kind of post from them (a korner's slug, or `posts` for
# their plain posts). Absence means you do. Set on the Mateship page
# (decisions.md, 2026-11-20).
class CreateMateTuneOuts < ActiveRecord::Migration[8.0]
  def change
    create_table :mate_tune_outs do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :target_account, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.string :korner_slug, null: false
      t.timestamps
    end

    add_index :mate_tune_outs, [:account_id, :target_account_id, :korner_slug], unique: true, name: 'index_mate_tune_outs_on_account_target_slug'
  end
end
