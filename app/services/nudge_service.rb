# frozen_string_literal: true

class NudgeService < BaseService
  def call(source_account, target_account)
    return if source_account.id == target_account.id

    # Use the sender's Account record as the activity so no separate table is needed.
    # NotifyService is called directly (not via LocalNotificationWorker) to skip the
    # dedup guard, allowing multiple nudges between the same pair of users.
    NotifyService.new.call(target_account, 'nudge', source_account)
  end
end
