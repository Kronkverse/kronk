# frozen_string_literal: true

# Kronk — Mates. The recipient declines a pending Mate request: the
# requester's FollowRequest is destroyed and nothing is established
# (docs/kronk_feed_and_reach.md §1).
module Mates
  class RejectService < BaseService
    def call(recipient_account, requester_account)
      return if recipient_account.nil? || requester_account.nil?
      return unless requester_account.requested?(recipient_account)

      RejectFollowService.new.call(requester_account, recipient_account)
    end
  end
end
