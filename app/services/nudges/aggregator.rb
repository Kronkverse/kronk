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

    # Resolve the aggregation window a notification type declares in its
    # korner manifest. Returns an ActiveSupport::Duration, or nil when the
    # type declares no window (or `aggregation: none`). This is the single
    # source of truth shared by the read side (grouping the Activity feed,
    # below) and the write side (Nudges::EventRouter collapsing an event
    # burst). Pass `korner_slug:` to narrow the search to one manifest —
    # write-side callers that already know their korner do, so a same-named
    # type in another manifest can't shadow theirs.
    def self.window_for(type, korner_slug: nil)
      manifests =
        if korner_slug
          [Kronk::KornerRegistry.find(korner_slug)].compact
        else
          Kronk::KornerRegistry.all
        end

      # KornerRegistry returns Array<Manifest> — plain arrays, so #each (not
      # AR's #find_each) is what applies here.
      manifests.each do |m|
        next unless m.notifications.is_a?(Array)

        entry = m.notifications.find { |t| t['name'].to_s == type.to_s }
        next unless entry

        aggregation = entry['aggregation']
        next if aggregation == 'none'
        next unless aggregation.is_a?(Hash) && aggregation['window']

        return parse_window(aggregation['window'])
      end
      nil
    end

    def self.parse_window(literal)
      case literal.to_s
      when /\A(\d+)h\z/ then ::Regexp.last_match(1).to_i.hours
      when /\A(\d+)m\z/ then ::Regexp.last_match(1).to_i.minutes
      when /\A(\d+)s\z/ then ::Regexp.last_match(1).to_i.seconds
      end
    end

    def initialize(notifications)
      @notifications = notifications.to_a.sort_by(&:created_at)
    end

    def groups
      current = {}
      finalised = []

      @notifications.each do |notification|
        key = group_key(notification)
        window = self.class.window_for(notification.type) || DEFAULT_WINDOW

        if current[key] && (notification.created_at - current[key].notifications.last.created_at) <= window
          current[key].notifications << notification
          current[key].actors << notification.from_account unless notification.from_account.nil? || current[key].actors.include?(notification.from_account)
        else
          finalised << current[key] if current[key]
          subject_type, subject_id = subject_identity(notification)
          current[key] = Group.new(
            type: notification.type.to_s,
            subject_type: subject_type,
            subject_id: subject_id,
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
      [notification.type, *subject_identity(notification)]
    end

    # The subject a notification is *about*. Froths and boosts each carry a
    # distinct activity record (one Favourite / reblog Status per actor), so
    # keying on activity_id never collapses them — which is the whole point
    # of the aggregator. Mirror Notification::Groups: the subject is the
    # underlying status (target_status) when there is one, else the raw
    # polymorphic activity for subjectless types (follows, admin, ...).
    def subject_identity(notification)
      status = notification.target_status
      return ['Status', status.id] if status

      [notification.activity_type, notification.activity_id]
    end
  end
end
