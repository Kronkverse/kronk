# frozen_string_literal: true

# Per-(viewer, korner, item) "seen" set — the standardised plumbing behind
# per-korner unread badges (see docs/spaces and the Nudges rework). One row
# means the account has seen one specific item of one korner.
#
# `content_id` is the item's own id, namespaced by `korner_slug`: a
# `statuses.id` for status-backed korners, a `moments.id` for Moments (the one
# korner with no backing Status). Ids are never compared across korners — the
# slug scopes every lookup — so mixing a status id and a moment id in the same
# column is safe.
#
# This IS the generic `moment_views` table the Moments spec calls for; Moments
# stores its rows here with `korner_slug = 'moments'` rather than getting a
# bespoke table.
#
# Rows only need to exist for items ABOVE the account's baseline marker
# (korner_seen_markers) — opening a korner sets the baseline and prunes rows at
# or below it — so this table stays small and self-pruning.
class CreateKornerContentViews < ActiveRecord::Migration[8.0]
  def change
    create_table :korner_content_views do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :korner_slug, null: false
      t.bigint :content_id, null: false

      t.datetime :created_at, null: false
    end

    add_index :korner_content_views, [:account_id, :korner_slug, :content_id],
              unique: true, name: 'index_korner_content_views_uniqueness'
    add_index :korner_content_views, [:account_id, :korner_slug]
  end
end
