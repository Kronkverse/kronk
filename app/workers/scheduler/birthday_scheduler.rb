# frozen_string_literal: true

# Nudges a member's Mates on their birthday. The birthday is the member's
# answer to the `birthday` profile Kuestion, an ISO date. Only a birthday
# pinned to their profile counts, and only Mates it reaches are nudged.
# Runs daily; only fires on the day itself.
#
# Recurrence: the notification type de-dupes per (receiver, activity, type)
# for all time, so a naive re-fire next year is silently dropped. We clear
# any prior-year birthday notification for the pair before enqueueing (and
# skip if we already nudged today), so it fires once per year.
class Scheduler::BirthdayScheduler
  include Sidekiq::Worker

  sidekiq_options retry: 0, lock: :until_executed, lock_ttl: 1.day.to_i

  ISO_DATE = /\A(\d{4})-(\d{2})-(\d{2})\z/

  def perform
    today = Time.now.utc.to_date

    todays_candidates(today).find_each do |answer|
      celebrant = answer.account
      next unless celebrant&.local? && !celebrant.suspended?

      match = ISO_DATE.match(answer.body)
      next unless match && celebrated_on?(today, match[2].to_i, match[3].to_i)

      notify_mates(answer, today)
    end
  end

  private

  # SQL prefilter on the "-MM-DD" suffix, verified in Ruby above. Not the
  # `pinned` scope: its ordering would fight find_each's.
  def todays_candidates(today)
    suffixes = [today.strftime('-%m-%d')]
    suffixes << '-02-29' if leap_day_moved_to?(today)

    Answer.birthdays
          .where.not(pinned_at: nil)
          .where(suffixes.map { 'answers.body LIKE ?' }.join(' OR '), *suffixes.map { |s| "%#{s}" })
          .includes(:account)
  end

  # A 29 February birthday is kept on 28 February in other years; it never
  # fired outside leap years.
  def celebrated_on?(today, month, day)
    return true if month == today.month && day == today.day

    month == 2 && day == 29 && leap_day_moved_to?(today)
  end

  def leap_day_moved_to?(today)
    today.month == 2 && today.day == 28 && !Date.leap?(today.year)
  end

  def notify_mates(answer, today)
    celebrant = answer.account
    celebrant.mates.where(domain: nil).find_each do |mate|
      next unless answer.visible_on_profile_to?(mate)

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
