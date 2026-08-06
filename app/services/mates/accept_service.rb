# frozen_string_literal: true

# Kronk — Mates. The recipient accepts a pending Mate request, establishing
# the mutual relationship (docs/kronk_feed_and_reach.md §1).
#
# One accept produces both directions of the follow graph:
#   1. authorize the requester's pending request  -> requester follows recipient
#   2. the recipient follows the requester back    -> mutual = Mates
#
# Both existing services merge home feeds (AuthorizeFollowService via
# FollowRequest#authorize!, FollowService via its direct-follow path), so the
# two accounts start seeing each other's posts immediately.
module Mates
  class AcceptService < BaseService
    def call(recipient_account, requester_account)
      @recipient = recipient_account
      @requester = requester_account

      return if @recipient.nil? || @requester.nil? || @recipient.id == @requester.id
      return unless @requester.requested?(@recipient)

      AuthorizeFollowService.new.call(@requester, @recipient)
      FollowService.new.call(@recipient, @requester, bypass_locked: true) unless @recipient.following?(@requester)

      # Nudges surface: tell the requester their request was
      # accepted. They're now Mates (the two follow calls above
      # made them mutual), but this is hand-wired anyway — paired
      # with `mates.request.sent` in the initializer, both bypass
      # the standard Mates gate for the same reason: the transition
      # to Mates is what these events are announcing.
      Kronk::KornerEvents.publish(
        'mates.request.accepted',
        actor_account_id: @recipient.id,
        recipient_account_id: @requester.id
      )

      true
    end
  end
end
