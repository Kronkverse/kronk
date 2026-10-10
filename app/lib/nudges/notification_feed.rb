# frozen_string_literal: true

# Nudges::NotificationFeed — everything addressed to one account, newest
# first, across every chat. Backs GET /api/v1/nudges/notifications
# (docs/spaces/nudges.md (Nudges spec) § Notifications list).
#
# Passive events about the same thing roll up across people: three froths on
# one post read as one row with three actors. Interactive events never roll
# up, since each is something to act on.
#
# Paging is by time over the raw events, then grouped within the page, so a
# group can split across a page boundary. That is accepted: the alternative
# is grouping in SQL, and the list is short.
module Nudges
  class NotificationFeed
    DEFAULT_LIMIT = 40
    MAX_LIMIT     = 80

    Group = Struct.new(:events) do
      def newest
        events.first
      end

      # Distinct actors, most recent first.
      def actors
        events.map(&:actor_account).uniq
      end

      def seen?
        events.all?(&:seen?)
      end
    end

    def self.unseen_count(account)
      scope_for(account).unseen.count
    end

    # Mark everything up to `up_to` as seen. The client passes the time it
    # loaded the list, so a notification that arrived while the list was open
    # is not swallowed unread.
    def self.mark_seen!(account, up_to: nil)
      now   = Time.current
      scope = Nudges::Event.addressed_to(account).unseen
      scope = scope.where(Nudges::Event.arel_table[:created_at].lteq(up_to)) if up_to
      scope.update_all(seen_at: now)
    end

    def self.scope_for(account)
      Nudges::Event
        .addressed_to(account)
        .joins(:actor_account)
        .merge(Account.without_suspended)
    end

    def initialize(account, before: nil, limit: nil)
      @account = account
      @before  = before
      @limit   = (limit.presence || DEFAULT_LIMIT).to_i.clamp(1, MAX_LIMIT)
    end

    def groups
      @groups ||= events.group_by { |event| group_key(event) }.values.map { |members| Group.new(members) }
    end

    # Cursor for the next page, or nil when this page was the last.
    def next_before
      events.size < @limit ? nil : events.last.created_at
    end

    private

    def events
      @events ||= begin
        scope = self.class.scope_for(@account).includes(actor_account: :account_stat)
        scope = scope.where(Nudges::Event.arel_table[:created_at].lt(@before)) if @before
        scope.order(created_at: :desc, id: :desc).limit(@limit).to_a
      end
    end

    def group_key(event)
      return [:single, event.id] if event.interactive? || event.source_type.blank? || event.source_id.blank?

      [event.source_korner_slug, event.verb, event.source_type, event.source_id]
    end
  end
end
