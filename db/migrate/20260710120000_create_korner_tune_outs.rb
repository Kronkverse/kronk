# frozen_string_literal: true

# Per-account list of korners the user has actively tuned out of.
# Presence of a row = tuned out; absence = tuned in. This "implicit
# default" scheme avoids a 1.5M-row backfill at migration time — every
# existing account keeps its "tuned in to everything" state without any
# rows being written.
#
# See docs/kronk_korner_spec.md §N.5 / feed gate §8.4.2.
class CreateKornerTuneOuts < ActiveRecord::Migration[8.0]
  def change
    create_table :korner_tune_outs do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :korner_slug, null: false
      t.datetime :tuned_out_at, null: false

      t.timestamps
    end

    add_index :korner_tune_outs, [:account_id, :korner_slug], unique: true
    add_index :korner_tune_outs, :korner_slug
  end
end
