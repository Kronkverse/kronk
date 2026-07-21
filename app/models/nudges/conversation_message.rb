# frozen_string_literal: true

# Nudges::ConversationMessage — a text/media/voice message posted into
# a Nudges::Conversation.
#
# `reactions` is a JSONB array of `{ account_id, symbol, created_at }`
# entries, capped at 3 DISTINCT symbols per message. The cap is
# enforced here and re-verified on write; the array shape lets us
# render reactions without a join query.
#
# Bumping the parent conversation's `last_activity_at` and updating
# the Mate relationship counter both happen in `after_create_commit`
# so the sidebar sort and depth pins stay honest.
module Nudges
  class ConversationMessage < ApplicationRecord
    self.table_name = 'nudges_conversation_messages'

    REACTION_CAP = 3

    belongs_to :conversation,
               class_name: 'Nudges::Conversation',
               inverse_of: :messages
    belongs_to :author_account, class_name: 'Account'
    belongs_to :media_attachment, optional: true
    belongs_to :voice_attachment, class_name: 'MediaAttachment', optional: true

    validate :body_or_attachment_present
    validate :reactions_within_cap

    before_validation :inherit_expiry_from_conversation, on: :create
    after_create_commit :bump_conversation_activity
    after_create_commit :increment_relationship_counter

    scope :not_expired, -> { where('expires_at IS NULL OR expires_at > ?', Time.current) }

    def add_reaction!(account, symbol)
      distinct = reactions.pluck('symbol').uniq
      return if distinct.include?(symbol) && already_reacted?(account, symbol)
      raise ReactionCapReached if distinct.count >= REACTION_CAP && distinct.exclude?(symbol)

      self.reactions = reactions + [{ 'account_id' => account.id, 'symbol' => symbol, 'created_at' => Time.current.iso8601 }]
      save!
    end

    def remove_reaction!(account, symbol)
      self.reactions = reactions.reject { |r| r['account_id'] == account.id && r['symbol'] == symbol }
      save!
    end

    class ReactionCapReached < StandardError; end

    private

    def already_reacted?(account, symbol)
      reactions.any? { |r| r['account_id'] == account.id && r['symbol'] == symbol }
    end

    def body_or_attachment_present
      return if body.present? || media_attachment_id.present? || voice_attachment_id.present?

      errors.add(:base, 'body or attachment required')
    end

    def reactions_within_cap
      return unless reactions.is_a?(Array)

      distinct = reactions.pluck('symbol').uniq
      errors.add(:reactions, "cannot exceed #{REACTION_CAP} distinct symbols") if distinct.count > REACTION_CAP
    end

    def inherit_expiry_from_conversation
      self.expires_at ||= conversation&.expires_at
    end

    def bump_conversation_activity
      conversation.update_column(:last_activity_at, created_at)
    end

    # Bump the shared Mate counter. If the increment crosses a milestone,
    # drop a pinned event into the stream so the pair sees it (§Surfaces
    # 3 — milestone pins are Mate-only). Attributed to the message
    # author — they tipped it over. Krew conversations don't have a
    # relationship counter (no 1:1 pair) so this short-circuits for
    # kind='krew'.
    def increment_relationship_counter
      return unless conversation.mate?

      relationship = Nudges::Relationship.for_pair(conversation.account_a_id, conversation.account_b_id)
      threshold    = relationship.record_message!
      return unless threshold

      Nudges::Event.create!(
        conversation: conversation,
        actor_account: author_account,
        source_korner_slug: 'nudges',
        verb: "milestone_#{threshold}",
        interaction: 'passive'
      )
    end
  end
end
