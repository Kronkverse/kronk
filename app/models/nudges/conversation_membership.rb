# frozen_string_literal: true

# Per-account membership in a Krew `Nudges::Conversation`. Holds the
# per-viewer `last_read_message_id` (Mate uses inline columns since
# exactly two participants; Krew needs a proper join).
module Nudges
  class ConversationMembership < ApplicationRecord
    self.table_name = 'nudges_conversation_memberships'

    belongs_to :conversation,
               class_name: 'Nudges::Conversation',
               inverse_of: :memberships
    belongs_to :account

    validates :account_id, uniqueness: { scope: :conversation_id }

    scope :muted,   -> { where(muted: true) }
    scope :unmuted, -> { where(muted: false) }

    before_validation :ensure_joined_at, on: :create

    private

    def ensure_joined_at
      self.joined_at ||= Time.current
    end
  end
end
