# frozen_string_literal: true

class AddInviteStateToNudgesConversationMemberships < ActiveRecord::Migration[8.0]
  def change
    add_column :nudges_conversation_memberships, :accepted_at, :datetime
    add_column :nudges_conversation_memberships, :invited_by_account_id, :bigint
  end
end
