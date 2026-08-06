# frozen_string_literal: true

# When a user signs up through an invite, auto-Mate them with the inviter.
# The pair becomes Mates immediately — a brand-new account starts with a
# non-empty home feed and a mutual connection to whoever brought them in,
# and the inviter's home feed picks up the new account's posts from the
# first one.
#
# "Mates" is Kronk's product-level mutual relationship (see
# docs/kronk_feed_and_reach.md §1) and is built on top of the follow graph:
# mutual follows = mates. So the worker calls FollowService in both
# directions with `bypass_locked: true`, mirroring what
# `Mates::AcceptService` does to establish mutuality. `bypass_locked` is
# safe on BOTH sides: an invitee's implicit consent is the fact they just
# signed up through your invite, and the inviter's implicit consent is
# the fact they issued the invite in the first place. Neither side
# should have to accept a pending request.
#
# Enqueued from User#enqueue_inviter_groove on create (invited users only),
# so any failure here never blocks or breaks signup. The worker + hook are
# still named "groove" for continuity with the message id / commit history;
# only the user-facing button label was renamed to "Mate" (PR #1192).
class AutoGrooveInviterWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'pull', retry: 3

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil?

    invitee = user.account
    inviter = user.invite&.user&.account
    return if inviter.nil? || invitee.nil? || inviter.id == invitee.id

    # Two follows = mates (Account::Interactions#mate? is derived as
    # mutual follow). Order isn't semantically significant, but calling
    # invitee -> inviter first mirrors the human intent ("the new person
    # sees the inviter's feed instantly").
    FollowService.new.call(invitee, inviter, bypass_locked: true)
    FollowService.new.call(inviter, invitee, bypass_locked: true) unless inviter.following?(invitee)
  rescue Mastodon::NotPermittedError, ActiveRecord::RecordNotFound => e
    Rails.logger.warn("AutoGrooveInviterWorker: user #{user_id} could not mate inviter: #{e.class} #{e.message}")
  end
end
