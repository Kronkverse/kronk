# frozen_string_literal: true

# Kronk — Mates. Undo the connection between two accounts. Covers both
# meanings of the "Unmate" control (docs/kronk_feed_and_reach.md §1):
#
#   - withdraw an outgoing Mate request that is still pending, and
#   - remove an established (mutual) Mate.
#
# Because Mates are mutual-only — one-way following is not a product state —
# tearing one down removes both directions. The reverse direction is only
# unwound when both accounts are local, so we never emit a spurious Undo on
# another instance's behalf across the wire.
module Mates
  class UnmateService < BaseService
    def call(source_account, target_account)
      @source = source_account
      @target = target_account

      return if @source.nil? || @target.nil? || @source.id == @target.id

      UnfollowService.new.call(@source, @target) if @source.following?(@target) || @source.requested?(@target)
      UnfollowService.new.call(@target, @source) if both_local? && @target.following?(@source)
    end

    private

    def both_local?
      @source.local? && @target.local?
    end
  end
end
