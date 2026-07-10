# frozen_string_literal: true

# Kronk::KornerEvents — the tiny in-process event bus for inter-korner
# communication per spec §6. Not distributed, not durable — just a way
# to keep korners loosely coupled while still letting them react to
# each other. Payload evolution is informal + additive.
#
# Producers publish; consumers subscribe by event name:
#
#   Kronk::KornerEvents.subscribe('huddle.started') do |payload|
#     Kalendar::HuddleLinker.new(payload).call
#   end
#
#   Kronk::KornerEvents.publish('huddle.started',
#                                huddle_session_id: 42,
#                                host_account_id: 17)
#
# Subscribers run synchronously in the publisher's thread. Long work
# should push to Sidekiq inside the subscriber, not run inline.
#
# Registrations survive Rails reloads via the initializer that wires
# each korner's `listens:` block to its handlers.

module Kronk
  module KornerEvents
    @subscribers = Hash.new { |h, k| h[k] = [] }
    @mutex = Mutex.new

    class << self
      def subscribe(name, &block)
        @mutex.synchronize { @subscribers[name.to_s] << block }
      end

      def publish(name, **payload)
        blocks = @mutex.synchronize { @subscribers[name.to_s].dup }
        blocks.each do |b|
          b.call(payload)
        rescue => e
          Rails.logger.warn("[kronk:korner_events:#{name}] subscriber raised: #{e.class} #{e.message}")
        end
        nil
      end

      def reset!
        @mutex.synchronize { @subscribers.clear }
      end

      def subscriber_count(name)
        @mutex.synchronize { @subscribers[name.to_s].size }
      end
    end
  end
end
