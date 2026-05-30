# frozen_string_literal: true

class NudgeService < BaseService
  def call(source_account, target_account, text: nil, media_attachment_id: nil, voice_attachment_id: nil, in_reply_to_notification_id: nil)
    return if source_account.id == target_account.id
    raise Mastodon::NotPermittedError unless nudge_allowed?(source_account, target_account)

    # Use the sender's Account record as the activity so no separate table is needed.
    # NotifyService is called directly (not via LocalNotificationWorker) to skip the
    # dedup guard, allowing multiple nudges between the same pair of users.
    NotifyService.new.call(target_account, 'nudge', source_account)

    # NotifyService doesn't return the notification, so look it up immediately.
    notification = Notification.where(
      account_id: target_account.id,
      from_account_id: source_account.id,
      type: 'nudge'
    ).order(id: :desc).first

    if notification && (text.present? || media_attachment_id.present? || voice_attachment_id.present? || in_reply_to_notification_id.present?)
      NudgeMessage.create!(
        notification: notification,
        body: text.presence,
        media_attachment_id: media_attachment_id.presence,
        voice_attachment_id: voice_attachment_id.presence,
        in_reply_to_notification_id: in_reply_to_notification_id.presence
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
