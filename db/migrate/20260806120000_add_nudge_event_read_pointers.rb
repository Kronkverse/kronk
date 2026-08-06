# frozen_string_literal: true

# Event-aware unread for Nudges: nudge *events* (not just messages) now count
# toward a conversation's unread, so a conversation whose only new item is a
# nudge still reads unread. Adds per-participant event read pointers beside the
# existing message pointers — inline on the mate conversation, on the
# membership join for krews. Nullable bigints; adding them is safe.
class AddNudgeEventReadPointers < ActiveRecord::Migration[8.0]
  def change
    add_column :nudges_conversations, :last_read_event_id_a, :bigint
    add_column :nudges_conversations, :last_read_event_id_b, :bigint
    add_column :nudges_conversation_memberships, :last_read_event_id, :bigint
  end
end
