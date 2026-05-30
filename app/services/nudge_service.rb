# frozen_string_literal: true

class NudgeService < BaseService
  def call(source_account, target_account, text: nil, media_attachment_id: nil)
    return if source_account.id == target_account.id
    raise Mastodon::NotPermittedError unless nudge_allowed?(source_account, target_account)

    # Use the sender's Account record as the activity so no separate table is needed.
    # NotifyService is called directly (not via LocalNotificationWorker) to skip the
    # dedup guard, allowing multiple nudges between the same pair of users.
    notification = NotifyService.new.call(target_account, 'nudge', source_account)

    if notification && (text.present? || media_attachment_id.present?)
      NudgeMessage.create!(
        notification: notification,
        body: text.presence,
        media_attachment_id: media_attachment_id.presence
      )
    end

    notification
  end

  private

  def nudge_allowed?(source, target)
    last = Notification.where(type: 'nudge')
                       .where(
                         '(account_id = ? AND from_account_id = ?) OR (account_id = ? AND from_account_id = ?)',
                         source.id, target.id, target.id, source.id
                       )
                       .order(id: :desc).first
    # Allowed if no nudges yet, or the last nudge came from the target (it's our turn).
    last.nil? || last.from_account_id == target.id
  end
end
