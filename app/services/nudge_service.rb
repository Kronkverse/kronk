# frozen_string_literal: true

class NudgeService < BaseService
  MAX_NUDGES = 9_999_999

  def call(source_account, target_account)
    return if source_account.id == target_account.id

    a, b = source_account.id, target_account.id
    current = Notification.where(type: 'nudge')
                          .where('(account_id = ? AND from_account_id = ?) OR (account_id = ? AND from_account_id = ?)', a, b, b, a)
                          .count
    raise Mastodon::NotPermittedError if current >= MAX_NUDGES

    # Use the sender's Account record as the activity so no separate table is needed.
    # NotifyService is called directly (not via LocalNotificationWorker) to skip the
    # dedup guard, allowing multiple nudges between the same pair of users.
    NotifyService.new.call(target_account, 'nudge', source_account)
  end
end
