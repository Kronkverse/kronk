# frozen_string_literal: true

# When a user signs up through an invite, auto-Groove (follow) the inviter.
# This gives a brand-new account a non-empty home feed and connects them to
# whoever brought them in. The inviter's follower-approval lock is bypassed —
# handing someone an invite is implicit consent to be followed back.
#
# Enqueued from User#enqueue_inviter_groove on create (invited users only), so
# a follow failure never blocks or breaks signup.
class AutoGrooveInviterWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'pull', retry: 3

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil?

    inviter  = user.invite&.user&.account
    follower = user.account
    return if inviter.nil? || follower.nil? || inviter.id == follower.id

    FollowService.new.call(follower, inviter, bypass_locked: true)
  rescue Mastodon::NotPermittedError, ActiveRecord::RecordNotFound => e
    Rails.logger.warn("AutoGrooveInviterWorker: user #{user_id} could not groove inviter: #{e.class} #{e.message}")
  end
end
