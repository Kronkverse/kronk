# frozen_string_literal: true

# Nudges::Aggregator — collapse repeated activity of the same
# (type, activity) pair within a rolling window into a single entry.
#
# Signal-style: five froths on the same post within 10 minutes render
# as "5 froths on your post" instead of five separate chat items. When
# the window elapses, subsequent activity starts a new group.
#
# Manifest overrides live in each korner's `notifications:` block. This
# service reads the defaults and per-type overrides from
# Kronk::KornerRegistry when resolving a window for a given type.
#
# Usage:
#   Nudges::Aggregator.for(notifications)
#     => Array<Group>  (chronological, most recent last)
#
# Group interface:
#   .type        String
#   .subject     Object (Status, Proposal, Event, ...)
#   .actors      Array<Account>   (unique, most recent first)
#   .count       Integer
#   .latest_at   Time             (of the most recent contributor)

module Nudges
  class Aggregator
    DEFAULT_WINDOW = 10.minutes

    Group = Struct.new(:type, :subject_type, :subject_id, :actors, :notifications, keyword_init: true) do
      def count
        notifications.size
      end

      def latest_at
        notifications.last.created_at
      end

      def subject
        notifications.last.activity
      end
    end

    def self.for(notifications)
      new(notifications).groups
    end

    def initialize(notifications)
      @notifications = notifications.to_a.sort_by(&:created_at)
    end

    def groups
      current = {}
      finalised = []

      @notifications.each do |notification|
        key = group_key(notification)
        window = window_for(notification.type)

        if current[key] && (notification.created_at - current[key].notifications.last.created_at) <= window
          current[key].notifications << notification
          current[key].actors << notification.from_account unless notification.from_account.nil? || current[key].actors.include?(notification.from_account)
        else
          finalised << current[key] if current[key]
          current[key] = Group.new(
            type: notification.type.to_s,
            subject_type: notification.activity_type,
            subject_id: notification.activity_id,
            actors: [notification.from_account].compact,
            notifications: [notification]
          )
        end
      end

      finalised.concat(current.values)
      finalised.sort_by(&:latest_at)
    end

    private

    def group_key(notification)
      [notification.type, notification.activity_type, notification.activity_id]
    end

    def window_for(type)
      manifest_window = notification_type_window(type)
      manifest_window || DEFAULT_WINDOW
    end

    def notification_type_window(type)
      # KornerRegistry.all returns Array<Manifest> — not AR, so find_each doesn't apply.
      Kronk::KornerRegistry.all.each do |manifest| # rubocop:disable Rails/FindEach
        next unless manifest.notifications.is_a?(Array)

        entry = manifest.notifications.find { |t| t['name'].to_s == type.to_s }
        next unless entry

        aggregation = entry['aggregation']
        next if aggregation == 'none'
        next unless aggregation.is_a?(Hash) && aggregation['window']

        return parse_window(aggregation['window'])
      end
      nil
    end

    def parse_window(literal)
      case literal.to_s
      when /\A(\d+)h\z/ then ::Regexp.last_match(1).to_i.hours
      when /\A(\d+)m\z/ then ::Regexp.last_match(1).to_i.minutes
      when /\A(\d+)s\z/ then ::Regexp.last_match(1).to_i.seconds
      end
    end
  end
end
