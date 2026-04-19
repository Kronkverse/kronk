# frozen_string_literal: true

class NudgeService < BaseService
  def call(source_account, target_account)
    return if source_account.id == target_account.id

    nudge = Nudge.create!(account: source_account, target_account: target_account)
    LocalNotificationWorker.perform_async(target_account.id, nudge.id, 'Nudge', 'nudge')
    nudge
  end
end
