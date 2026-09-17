# frozen_string_literal: true

# Nudges::Event — inline system event rendered in a conversation
# stream. Not a message. Sourced by the korner event bus and routed
# into the recipient's Mate/Krew via manifest `emits:` / `listens:`.
#
# `source_type` + `source_id` is a lightweight polymorphic ref — we
# store the reference, not a copy. When the source is destroyed the
# event still exists but the reader-side resolves to a tombstone.
module Nudges
  class Event < ApplicationRecord
    self.table_name = 'nudges_events'

    INTERACTIONS = %w(interactive passive).freeze
    INTERACTIVE  = 'interactive'
    PASSIVE      = 'passive'

    belongs_to :conversation,
               class_name: 'Nudges::Conversation',
               inverse_of: :events
    belongs_to :actor_account, class_name: 'Account'

    validates :source_korner_slug, presence: true
    validates :verb, presence: true
    validates :interaction, inclusion: { in: INTERACTIONS }
    validate  :cta_only_for_interactive

    before_validation :ensure_created_at, on: :create
    after_create_commit :bump_conversation_activity
    after_create_commit :publish_stream_created

    def source
      return nil unless source_type.present? && source_id.present?

      source_type.constantize.find_by(id: source_id)
    end

    def interactive?
      interaction == INTERACTIVE
    end

    private

    def cta_only_for_interactive
      return if interactive?

      errors.add(:cta_route, 'only interactive events carry a CTA') if cta_label.present? || cta_route.present?
    end

    def ensure_created_at
      self.created_at ||= Time.current
    end

    def bump_conversation_activity
      conversation.update_column(:last_activity_at, created_at)
    end

    def publish_stream_created
      Nudges::StreamPublisher.event_created(self)
    end
  end
end
