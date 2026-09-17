# frozen_string_literal: true

# Publishes Nudges::Conversation lifecycle events onto Redis pub/sub
# for the streaming service to fan out to any active WebSocket clients.
# The client subscribes to `nudges:conversation` (see streaming/index.js
# `case 'nudges:conversation'`) which resolves to the Redis channel
# `timeline:nudges:conversation:<id>`.
#
# Event envelope matches the shape upstream Mastodon streaming uses:
#   { event: 'nudges.message.created', payload: <serialized JSON> }
#
# Payload is a JSON *string* (not a hash) — the streaming service
# forwards the payload verbatim, and the client `JSON.parse`s it in one
# hop, keeping the wire consistent with `user:notification` semantics.
module Nudges
  module StreamPublisher
    module_function

    CHANNEL         = 'nudges:conversation'
    ACCOUNT_CHANNEL = 'nudges:account'

    def message_created(message)
      serialized = serialize_message(message)
      publish(message.conversation_id, 'nudges.message.created', serialized)
      fan_to_accounts(message.conversation, 'nudges.message.created', serialized)
    end

    def message_updated(message)
      publish(message.conversation_id, 'nudges.message.updated', serialize_message(message))
    end

    def message_deleted(message)
      publish(message.conversation_id, 'nudges.message.deleted', serialize_message(message))
    end

    def event_created(event)
      serialized = serialize_event(event)
      publish(event.conversation_id, 'nudges.event.created', serialized)
      fan_to_accounts(event.conversation, 'nudges.event.created', serialized)
    end

    def read_pointer(conversation:, reader_account_id:, up_to_message_id:)
      payload = {
        conversation_id: conversation.id.to_s,
        reader_account_id: reader_account_id.to_s,
        last_read_message_id: up_to_message_id&.to_s,
      }
      publish(conversation.id, 'nudges.read', payload.to_json)
    end

    # Redis pub/sub is per-conversation; the streaming service adds the
    # participant-auth check so only members can subscribe.
    def publish(conversation_id, event, payload_json)
      RedisConnection.with do |redis|
        redis.publish(
          "timeline:#{CHANNEL}:#{conversation_id}",
          Oj.dump(event: event, payload: payload_json)
        )
      end
    rescue => e
      Rails.logger.warn("Nudges::StreamPublisher failed for conversation=#{conversation_id} event=#{event}: #{e.class}: #{e.message}")
    end

    # Fan the same envelope to every participant's ACCOUNT-level channel, so a
    # member sitting on /nudges gets the live push even for a conversation they
    # don't currently have open (the per-conversation channel can't reach them
    # there — nobody's subscribed to a brand-new conversation's channel). The
    # client subscribes to `nudges:account` (streaming/index.js) → the Redis
    # channel `timeline:nudges:account:<account_id>`.
    def fan_to_accounts(conversation, event, payload_json)
      participant_account_ids(conversation).each do |account_id|
        publish_account(account_id, event, payload_json)
      end
    end

    def participant_account_ids(conversation)
      if conversation.mate?
        [conversation.account_a_id, conversation.account_b_id].compact
      else
        conversation.memberships.pluck(:account_id)
      end
    end

    def publish_account(account_id, event, payload_json)
      RedisConnection.with do |redis|
        redis.publish(
          "timeline:#{ACCOUNT_CHANNEL}:#{account_id}",
          Oj.dump(event: event, payload: payload_json)
        )
      end
    rescue => e
      Rails.logger.warn("Nudges::StreamPublisher account fan-out failed for account=#{account_id} event=#{event}: #{e.class}: #{e.message}")
    end

    def serialize_message(message)
      REST::Nudges::MessageSerializer.new(message).to_json
    end

    def serialize_event(event)
      REST::Nudges::EventSerializer.new(event).to_json
    end
  end
end
