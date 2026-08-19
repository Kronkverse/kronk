# frozen_string_literal: true

# Nudges a member's Mates on their birthday. The birthday lives on the
# member's profile as a `birthday` ProfileCard whose body is an ISO date
# (see the profile date field). Runs daily; only fires on the day itself.
#
# Recurrence: the notification type de-dupes per (receiver, activity, type)
# for all time, so a naive re-fire next year is silently dropped. We clear
# any prior-year birthday notification for the pair before enqueueing (and
# skip if we already nudged today), so it fires once per year.
class Scheduler::BirthdayScheduler
  include Sidekiq::Worker

  sidekiq_options retry: 0, lock: :until_executed, lock_ttl: 1.day.to_i

  ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/

  def perform
    today = Time.now.utc.to_date

    todays_candidates(today).find_each do |card|
      celebrant = card.account
      next unless celebrant&.local? && !celebrant.suspended?

      match = ISO_DATE.match(card.body)
      next unless match && match[2].to_i == today.month && match[3].to_i == today.day

      notify_mates(celebrant, today)
    end
  end

  private

  # SQL prefilter on the "-MM-DD" suffix (body is sanitised HTML like
  # "<p>1999-11-01</p>"), verified in Ruby above.
  def todays_candidates(today)
    ProfileCard.where(card_type: 'birthday')
               .where('body LIKE ?', "%#{today.strftime('-%m-%d')}%")
               .includes(:account)
  end

  def notify_mates(celebrant, today)
    celebrant.mates.where(domain: nil).find_each do |mate|
      pair = Notification.where(account_id: mate.id, from_account_id: celebrant.id, type: 'birthday')

      # Already nudged for this year's birthday — idempotent across retries.
      next if pair.exists?(created_at: today.beginning_of_day..)

      # Drop last year's nudge so the once-per-(receiver, activity, type)
      # de-dupe in LocalNotificationWorker lets this year's through.
      pair.delete_all

      LocalNotificationWorker.perform_async(mate.id, celebrant.id, 'Account', 'birthday')
    end
  end
end
