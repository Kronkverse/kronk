# frozen_string_literal: true

# Weekly re-fire of the email confirmation reminder for any user who is
# still unconfirmed after 7 days. The first reminder lands at signup
# via `User#fire_email_confirmation_reminder`; this worker owns every
# subsequent nudge until `confirmed_at` is set (at which point
# `User#clear_email_confirmation_reminders` sweeps the pane clean).
#
# Cadence declared in `config/sidekiq.yml` — Monday 09:00 UTC by
# default. Each notification bumps the card to the top of the Kronk
# system pane (via a fresh `created_at`), so a user who never confirms
# sees a single reminder that keeps re-surfacing rather than a growing
# pile.
class Scheduler::EmailConfirmationReminderScheduler
  include Sidekiq::Worker

  sidekiq_options retry: 0

  REMIND_AFTER = 7.days

  def perform
    threshold = REMIND_AFTER.ago

    User.where(confirmed_at: nil).find_each do |user|
      last_reminder_at = Notification.where(
        type: 'email_confirmation_reminder',
        account_id: user.account_id,
        activity_type: 'User',
        activity_id: user.id
      ).maximum(:created_at)

      next if last_reminder_at.present? && last_reminder_at > threshold

      DeliverEmailConfirmationReminderService.new.call(user)
    end
  end
end
