# frozen_string_literal: true

# Activity lines leave the chats (docs/decisions.md, 2026-10-10). An event
# addressed to a person no longer needs a chat to exist in: it lives in their
# notifications list. An event without a recipient still belongs to its chat
# (a Krew join line, a Mate message milestone).
#
# So `conversation_id` becomes optional, and the events that are addressed to
# someone are taken out of the chats they were filed under.
class DetachNudgeNotificationsFromChats < ActiveRecord::Migration[8.0]
  def up
    change_column_null :nudges_events, :conversation_id, true

    safety_assured do
      # Events written since the recipient column arrived were still shown in
      # chats, and read there. Carry that over before they leave: anything at
      # or below the recipient's event pointer in that chat has been seen.
      execute(<<~SQL.squish)
        UPDATE nudges_events e
        SET seen_at = e.created_at
        FROM nudges_conversations c
        WHERE c.id = e.conversation_id
          AND c.kind = 'mate'
          AND e.recipient_account_id IS NOT NULL
          AND e.seen_at IS NULL
          AND e.id <= COALESCE(CASE WHEN c.account_a_id = e.recipient_account_id THEN c.last_read_event_id_a ELSE c.last_read_event_id_b END, 0)
      SQL

      execute('UPDATE nudges_events SET conversation_id = NULL WHERE recipient_account_id IS NOT NULL AND conversation_id IS NOT NULL')
    end
  end

  # Put each addressed event back in the Mate chat between its actor and its
  # recipient, creating that chat where it does not exist.
  def down
    safety_assured do
      execute(<<~SQL.squish)
        INSERT INTO nudges_conversations (kind, account_a_id, account_b_id, last_activity_at, created_at, updated_at)
        SELECT DISTINCT 'mate', LEAST(e.actor_account_id, e.recipient_account_id), GREATEST(e.actor_account_id, e.recipient_account_id), NOW(), NOW(), NOW()
        FROM nudges_events e
        WHERE e.conversation_id IS NULL
          AND e.recipient_account_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM nudges_conversations c
            WHERE c.kind = 'mate'
              AND c.account_a_id = LEAST(e.actor_account_id, e.recipient_account_id)
              AND c.account_b_id = GREATEST(e.actor_account_id, e.recipient_account_id)
          )
      SQL

      execute(<<~SQL.squish)
        UPDATE nudges_events e
        SET conversation_id = c.id
        FROM nudges_conversations c
        WHERE e.conversation_id IS NULL
          AND e.recipient_account_id IS NOT NULL
          AND c.kind = 'mate'
          AND c.account_a_id = LEAST(e.actor_account_id, e.recipient_account_id)
          AND c.account_b_id = GREATEST(e.actor_account_id, e.recipient_account_id)
      SQL
    end

    change_column_null :nudges_events, :conversation_id, false
  end
end
