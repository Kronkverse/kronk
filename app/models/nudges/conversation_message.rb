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
    MAX_MEDIA    = 4 # matches Mastodon Status default

    belongs_to :conversation,
               class_name: 'Nudges::Conversation',
               inverse_of: :messages
    belongs_to :author_account, class_name: 'Account'
    belongs_to :media_attachment, optional: true # legacy Phase 1i column
    belongs_to :voice_attachment, class_name: 'MediaAttachment', optional: true

    validate :body_or_attachment_present
    validate :reactions_within_cap
    validate :media_within_cap

    before_validation :inherit_expiry_from_conversation, on: :create
    after_create_commit :bump_conversation_activity
    after_create_commit :increment_relationship_counter

    scope :not_expired, -> { where('expires_at IS NULL OR expires_at > ?', Time.current) }
    scope :live,        -> { where(deleted_at: nil) }
    scope :tombstoned,  -> { where.not(deleted_at: nil) }

    # Tombstone-and-410 per docs/kronk_nudges.md non-negotiables. The
    # row stays (id claimed, no reuse) but body/media/reactions are
    # cleared and the serializer redacts. Reactions on a tombstoned
    # message raise `Tombstoned` so the controller can 410.
    def tombstone!
      update!(
        deleted_at: Time.current,
        body: nil,
        media_attachment_id: nil,
        media_attachment_ids: [],
        voice_attachment_id: nil,
        reactions: []
      )
    end

    # Unified view of attachments — legacy singular column + new array
    # column merged, dedup preserving insertion order. Callers should
    # prefer this over the raw fields.
    def all_media_ids
      [media_attachment_id, *media_attachment_ids].compact.uniq
    end

    def media_attachments_all
      ids = all_media_ids
      return [] if ids.empty?

      MediaAttachment.where(id: ids).index_by(&:id).values_at(*ids).compact
    end

    def tombstoned?
      deleted_at.present?
    end

    def add_reaction!(account, symbol)
      raise Tombstoned if tombstoned?

      distinct = reactions.pluck('symbol').uniq
      return if distinct.include?(symbol) && already_reacted?(account, symbol)
      raise ReactionCapReached if distinct.count >= REACTION_CAP && distinct.exclude?(symbol)

      self.reactions = reactions + [{ 'account_id' => account.id, 'symbol' => symbol, 'created_at' => Time.current.iso8601 }]
      save!
    end

    def remove_reaction!(account, symbol)
      raise Tombstoned if tombstoned?

      self.reactions = reactions.reject { |r| r['account_id'] == account.id && r['symbol'] == symbol }
      save!
    end

    class ReactionCapReached < StandardError; end
    class Tombstoned < StandardError; end

    private

    def already_reacted?(account, symbol)
      reactions.any? { |r| r['account_id'] == account.id && r['symbol'] == symbol }
    end

    def body_or_attachment_present
      return if body.present? || media_attachment_id.present? || voice_attachment_id.present? || media_attachment_ids.present?

      errors.add(:base, 'body or attachment required')
    end

    def media_within_cap
      count = all_media_ids.size
      errors.add(:media_attachment_ids, "cannot exceed #{MAX_MEDIA} attachments") if count > MAX_MEDIA
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
