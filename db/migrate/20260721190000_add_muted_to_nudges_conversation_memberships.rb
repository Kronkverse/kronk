# frozen_string_literal: true

# Per-account mute on a Krew (group) conversation. Muted rows dim in
# the sidebar and don't drive unread badges. Mate has no mute — a
# Mate conversation is the pair itself, and muting it is functionally
# equivalent to unfollowing.
class AddMutedToNudgesConversationMemberships < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :nudges_conversation_memberships, :muted, :boolean, default: false, null: false
    end
  end
end
