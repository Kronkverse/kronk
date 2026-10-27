# frozen_string_literal: true

# Nudges::WebPushWorker — one nudge to one push subscription. Reuses the
# encryption and request handling of Mastodon's Web::PushNotificationWorker
# (a subclass rather than an edit, so upstream merges stay clean) and only
# swaps what is sent: a Nudges::PushPayload, which the service worker shows
# as it is (service_worker/web_push_notifications.js, `kronk_nudge`).
#
# For someone who chose "Just a ping" (Nudges::PushPreferences.ping?) it
# sends Nudges::PushPayload.ping instead: no names, no words, one fixed tag.
# A legacy Notification comes here too in that case (`kind` 'notification',
# from NotifyService), so it pings rather than say what happened.
class Nudges::WebPushWorker < Web::PushNotificationWorker
  sidekiq_options queue: 'push', retry: 5

  def perform(subscription_id, kind, id)
    @subscription = Web::PushSubscription.find(subscription_id)
    @record = find_record(kind, id)

    return if @record.created_at < TTL.ago

    unless @subscription.valid?
      @subscription.destroy!
      return
    end

    if web_push_request.legacy
      perform_legacy_request
    else
      perform_standard_request
    end
  rescue ActiveRecord::RecordNotFound
    true
  end

  private

  def find_record(kind, id)
    case kind
    when 'message' then Nudges::ConversationMessage.find(id)
    when 'notification' then Notification.find(id)
    else Nudges::Event.find(id)
    end
  end

  def push_notification_json
    I18n.with_locale(@subscription.locale.presence || I18n.default_locale) do
      Oj.dump(payload)
    end
  end

  def payload
    return Nudges::PushPayload.ping(at: @record.created_at) if ping?

    Nudges::PushPayload.new(@record, recipient: @subscription.user.account).as_json
  end

  # A legacy Notification only comes here to be a ping; it has no other shape.
  def ping?
    @record.is_a?(Notification) || Nudges::PushPreferences.ping?(@subscription.user)
  end
end
