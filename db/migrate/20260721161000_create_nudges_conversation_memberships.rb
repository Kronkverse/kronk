# frozen_string_literal: true

# Per-account membership + read state for Krew (group) conversations.
# Mate uses inline `last_read_message_id_a` / `_b` on the conversation
# row (exactly two participants); Krew needs a proper join.
class CreateNudgesConversationMemberships < ActiveRecord::Migration[8.0]
  def change
    create_table :nudges_conversation_memberships do |t|
      t.references :conversation, null: false, foreign_key: { to_table: :nudges_conversations, on_delete: :cascade }
      t.references :account, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.bigint     :last_read_message_id
      t.datetime   :joined_at, null: false

      t.timestamps
    end

    add_index :nudges_conversation_memberships, [:conversation_id, :account_id],
              unique: true,
              name: 'index_nudges_convo_memberships_on_pair'
  end
end
