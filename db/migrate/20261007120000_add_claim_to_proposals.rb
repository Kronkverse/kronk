# frozen_string_literal: true

# Kommons dev workflow, v0 (docs/spaces/kommons.md "Dev workflow"): a dev
# claims an open proposal so the proposer — and every other dev — can see
# someone is on it. The `claimed` state itself is a new enum integer on the
# existing `status` column (7), so it needs no schema change; this adds who
# claimed it and when.
#
# Structured for strong_migrations (same pattern as
# AddVoiceMediaAttachmentIdToMoments): `add_column` plus a separate
# concurrent partial index, no `add_reference` shortcut and no table lock.
# No FK: a soft link, `optional: true` on the model, cleared on unclaim.
class AddClaimToProposals < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :proposals, :claimed_by_account_id, :bigint, if_not_exists: true
    add_column :proposals, :claimed_at, :datetime, if_not_exists: true

    add_index :proposals, :claimed_by_account_id,
              algorithm: :concurrently,
              where: 'claimed_by_account_id IS NOT NULL',
              if_not_exists: true
  end

  def down
    remove_index :proposals, :claimed_by_account_id, algorithm: :concurrently, if_exists: true
    remove_column :proposals, :claimed_at, if_exists: true
    remove_column :proposals, :claimed_by_account_id, if_exists: true
  end
end
