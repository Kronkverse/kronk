# frozen_string_literal: true

# Fires an `email_confirmation_reminder` notification into the target
# user's Kronk system pane (Nudges messenger → the `kronk` sentinel
# conversation). Producer for the once-at-signup + weekly reminder
# loop; the message is a soft persistent nudge, never a wall.
#
# Idempotent-ish by design: any existing reminder for the same user is
# destroyed first so the new row's `created_at` is fresh — this keeps
# a single card at the top of the Kronk pane, rather than a growing
# stack of "please confirm" repeats. `#call` returns the newly-created
# Notification (or nil if there's nothing to remind about).
class DeliverEmailConfirmationReminderService < BaseService
  def call(user)
    return if user.nil? || user.confirmed? || user.account.nil?

    scope = Notification.where(
      type: 'email_confirmation_reminder',
      account_id: user.account_id,
      activity_type: 'User',
      activity_id: user.id
    )
    scope.destroy_all

    Notification.create!(
      account_id: user.account_id,
      from_account_id: user.account_id,
      type: 'email_confirmation_reminder',
      activity_type: 'User',
      activity_id: user.id
    )
  end
end
