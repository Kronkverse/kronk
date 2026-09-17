# frozen_string_literal: true

# Nudges::Relationship — Mate depth counters. One row per Mate pair
# (unique on sorted `[account_a_id, account_b_id]` with a < b).
#
# `message_count` is BOTH-DIRECTIONS combined per Tal's 2026-07-21
# decision — the milestone metric is the shared message count, not
# a per-user achievement. Milestones fire at
# `MILESTONE_THRESHOLDS = [250, 500, 1000, 2000, 4000, 8000, 10000]`
# — `last_milestone_hit` is the highest threshold crossed so far, so
# a pin is emitted exactly once at each boundary.
#
# Split from `nudges_conversations` because a relationship survives
# even if the Mate conversation is time-boxed and expires; the counter
# persists.
class CreateNudgesRelationships < ActiveRecord::Migration[8.0]
  def change
    create_table :nudges_relationships do |t|
      t.references :account_a, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.references :account_b, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.integer    :message_count, null: false, default: 0
      t.integer    :last_milestone_hit, null: false, default: 0

      t.timestamps
    end

    add_index :nudges_relationships, [:account_a_id, :account_b_id], unique: true, name: 'index_nudges_relationships_on_pair'
  end
end
