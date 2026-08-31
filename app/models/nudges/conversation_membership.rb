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
    # Who invited this account (set only for a pending Krew-chat invite;
    # cleared/irrelevant once accepted). See #pending?.
    belongs_to :invited_by, class_name: 'Account', foreign_key: 'invited_by_account_id', optional: true, inverse_of: false

    validates :account_id, uniqueness: { scope: :conversation_id }

    scope :muted,   -> { where(muted: true) }
    scope :unmuted, -> { where(muted: false) }

    # A Krew-chat invite the account hasn't accepted yet: invited_by set,
    # accepted_at still null. Everything else (normal joins, accepted invites)
    # is active.
    scope :pending, -> { where.not(invited_by_account_id: nil).where(accepted_at: nil) }
    scope :active,  -> { where(invited_by_account_id: nil).or(where.not(accepted_at: nil)) }

    before_validation :ensure_joined_at, on: :create

    def pending?
      invited_by_account_id.present? && accepted_at.nil?
    end

    private

    def ensure_joined_at
      self.joined_at ||= Time.current
    end
  end
end
