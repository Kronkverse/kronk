# frozen_string_literal: true

class NudgeService < BaseService
  def call(source_account, target_account, text: nil, media_attachment_id: nil, voice_attachment_id: nil, in_reply_to_notification_id: nil)
    return if source_account.id == target_account.id

    # Use the sender's Account record as the activity so no separate table is needed.
    # NotifyService is called directly (not via LocalNotificationWorker) to skip the
    # dedup guard, allowing multiple nudges between the same pair of users.
    # skip_push: true defers streaming dispatch so we can attach the NudgeMessage
    # before the receiver's client serializes the payload.
    notify_service = NotifyService.new
    notification = notify_service.call(target_account, 'nudge', source_account, skip_push: true)

    if notification && (text.present? || media_attachment_id.present? || voice_attachment_id.present? || in_reply_to_notification_id.present?)
      begin
        NudgeMessage.create!(
          notification: notification,
          body: text.presence,
          media_attachment_id: media_attachment_id.presence,
          voice_attachment_id: voice_attachment_id.presence,
          in_reply_to_notification_id: in_reply_to_notification_id.presence
        )
      rescue ActiveRecord::RecordInvalid => e
        # Message body is the only validated field (word count). Log and
        # keep the bare notification — caller still gets a successful response.
        Rails.logger.warn("NudgeService: message create failed (#{e.message}); kept plain nudge")
      end
    end

    # Dispatch streaming + push now that the message is in the database.
    # If the streaming/push hop fails (Redis hiccup, push gateway timeout,
    # etc.) the notification + message are already committed, so swallow
    # the error rather than letting the controller render 500 — the receiver
    # will still see the message on next thread load / poll.
    if notification
      begin
        notify_service.dispatch!
      rescue => e
        Rails.logger.warn("NudgeService: dispatch failed for notification #{notification.id} (#{e.class}: #{e.message})")
      end
    end

    notification
  end
end
