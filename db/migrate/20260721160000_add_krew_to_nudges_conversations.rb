# frozen_string_literal: true

# Krew conversations join the messenger — `nudges_conversations.kind`
# already accepts 'krew', but the row needed a `krew_id` reference
# and Mate's `account_a_id`/`account_b_id` needed to become nullable
# (only Mate uses them).
#
# The uniqueness index on (account_a_id, account_b_id) now excludes
# Krew rows via a partial-index predicate.
class AddKrewToNudgesConversations < ActiveRecord::Migration[8.0]
  def change
    add_reference :nudges_conversations, :krew,
                  foreign_key: { to_table: :groups, on_delete: :cascade },
                  null: true

    change_column_null :nudges_conversations, :account_a_id, true
    change_column_null :nudges_conversations, :account_b_id, true

    remove_index :nudges_conversations, [:account_a_id, :account_b_id],
                 unique: true,
                 name: 'index_nudges_convos_on_mate_pair'
    add_index :nudges_conversations, [:account_a_id, :account_b_id],
              unique: true,
              where: "kind = 'mate' AND account_a_id IS NOT NULL AND account_b_id IS NOT NULL",
              name: 'index_nudges_convos_on_mate_pair'

    add_index :nudges_conversations, :krew_id,
              unique: true,
              where: 'krew_id IS NOT NULL',
              name: 'index_nudges_convos_on_krew_id_unique'
  end
end
