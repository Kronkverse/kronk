# frozen_string_literal: true

# Per-(viewer, korner) baseline that bounds the seen-set in
# korner_content_views. `baseline_id` is the highest content id the account is
# treated as having seen wholesale: everything with `content_id <= baseline_id`
# counts as seen, so korner_content_views only carries rows for items ABOVE the
# baseline. Opening a korner advances the baseline to the korner's newest item
# and prunes the now-redundant per-item rows.
#
# Companion to korner_content_views; same account-keyed, slug-scoped shape as
# korner_tune_outs (docs/kronk_korner_spec.md §N.5).
class CreateKornerSeenMarkers < ActiveRecord::Migration[8.0]
  def change
    create_table :korner_seen_markers do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :korner_slug, null: false
      t.bigint :baseline_id, null: false, default: 0

      t.timestamps
    end

    add_index :korner_seen_markers, [:account_id, :korner_slug], unique: true
  end
end
