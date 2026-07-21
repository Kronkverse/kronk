# frozen_string_literal: true

# Nudges::ConversationMessage — a text/media/voice message in a
# Nudges::Conversation. Named explicitly to avoid collision with the
# legacy `nudge_messages` table (which sits on Notification and backs
# the retiring `/nudges/activity` surface until Phase 14 cleans it up).
#
# `reactions` is JSONB — `[{ account_id, symbol, created_at }, ...]`,
# capped at 3 DISTINCT symbols per message, enforced at model level.
# JSONB over a join table because reactions are read every render and
# the cap keeps the row bounded.
class CreateNudgesConversationMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :nudges_conversation_messages do |t|
      t.references :conversation, null: false, foreign_key: { to_table: :nudges_conversations, on_delete: :cascade }
      t.references :author_account, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.text       :body # null when attachment-only
      t.bigint     :media_attachment_id # image or video, via existing MediaAttachment
      t.bigint     :voice_attachment_id # separate ref for voice notes (kronk-app parity-gated)
      t.jsonb      :reactions, null: false, default: []
      t.datetime   :expires_at # inherits from conversation.expires_at at insert; null = permanent

      t.timestamps
    end

    add_index :nudges_conversation_messages, [:conversation_id, :id], order: { id: :desc }, name: 'index_nudges_msgs_on_convo_recency'
    add_index :nudges_conversation_messages, :media_attachment_id, where: 'media_attachment_id IS NOT NULL'
    add_index :nudges_conversation_messages, :voice_attachment_id, where: 'voice_attachment_id IS NOT NULL'
    add_index :nudges_conversation_messages, :expires_at, where: 'expires_at IS NOT NULL'
  end
end
