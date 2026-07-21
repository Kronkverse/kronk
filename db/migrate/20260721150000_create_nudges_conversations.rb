# frozen_string_literal: true

# Nudges::Conversation — the Signal-shaped messenger's primary entity.
# Phase 1 ships Mate (1:1) only; `kind = 'mate'` is enforced at model
# level. Krew ships in a follow-up (see docs/kronk_nudges.md).
#
# Mate identity: unique on `(account_a_id, account_b_id)` with a < b
# invariant enforced at model save so lookups are symmetric.
#
# Read state lives inline (`last_read_message_id_a`, `_b`) rather than
# in a join table — Mate has exactly two participants so a join buys
# nothing. When Krew ships it introduces its own membership table with
# per-member read pointers.
class CreateNudgesConversations < ActiveRecord::Migration[8.0]
  def change
    create_table :nudges_conversations do |t|
      t.string     :kind, null: false, default: 'mate' # mate | krew (krew unused Phase 1)
      t.references :account_a, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.references :account_b, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.bigint     :last_read_message_id_a
      t.bigint     :last_read_message_id_b
      t.datetime   :last_activity_at, null: false
      t.datetime   :expires_at # time-boxed conversations; null = permanent

      t.timestamps
    end

    # Symmetric-pair uniqueness: model enforces account_a_id < account_b_id.
    add_index :nudges_conversations, [:account_a_id, :account_b_id], unique: true, name: 'index_nudges_convos_on_mate_pair'
    add_index :nudges_conversations, :last_activity_at, order: :desc
    add_index :nudges_conversations, :expires_at, where: 'expires_at IS NOT NULL'
  end
end
