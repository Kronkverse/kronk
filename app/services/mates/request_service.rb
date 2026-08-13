# frozen_string_literal: true

# Kronk — Mates. Send a Mate request from source to target.
#
# Mates are the mutual, consent-on-both-sides relationship that replaces
# one-way following (docs/kronk_feed_and_reach.md §1). A pending request is
# stored as a FollowRequest in the requester -> target direction; the target
# turns it into a mutual follow by accepting via Mates::AcceptService.
#
# Idempotent and symmetric-aware:
#   - already Mates            -> no-op
#   - the target already asked -> accept theirs (instant mutual)
#   - a request already pending -> no-op
#   - a stale one-way follow    -> normalised into a clean pending request
module Mates
  class RequestService < BaseService
    def call(source_account, target_account)
      @source = source_account
      @target = target_account

      return if @source.nil? || @target.nil? || @source.id == @target.id
      return if @source.mate?(@target)
      return Mates::AcceptService.new.call(@source, @target) if @target.requested?(@source)
      return if @source.requested?(@target)

      @source.unfollow!(@target) if @source.following?(@target)

      request = @source.request_follow!(@target, rate_limit: true)
      notify!(request)
      request
    end

    private

    def notify!(request)
      return unless @target.local?

      LocalNotificationWorker.perform_async(@target.id, request.id, request.class.name, 'follow_request')

      # Nudges surface: the legacy bell notification alone doesn't
      # reach the messenger. A mate request is inherently non-Mate
      # (the two accounts aren't mutual yet — that's the whole
      # point), so the standard `Nudges::EventRouter` path would
      # drop it as `:non_mate_dropped`. Instead, emit an event that
      # the hand-wired subscriber in `nudges_event_bus.rb` picks up
      # and drops onto their (soon-to-be) Mate conversation
      # directly, bypassing the Mates gate.
      Kronk::KornerEvents.publish(
        'mates.request.sent',
        actor_account_id: @source.id,
        # `actor_acct` templates the nudge's `cta_route` in
        # config/korners/nudges.yaml — the CTA deep-links to the
        # requester's profile (`/@{actor_acct}`), which is where the
        # accept/reject affordances live (Tal 2026-08-13: "the link
        # should be to their profile instead of /mate_requests").
        actor_acct: @source.acct,
        recipient_account_id: @target.id,
        follow_request_id: request.id
      )
    end
  end
end
