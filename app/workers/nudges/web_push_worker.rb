# frozen_string_literal: true

# Nudges::WebPushWorker — one nudge to one push subscription. Reuses the
# encryption and request handling of Mastodon's Web::PushNotificationWorker
# (a subclass rather than an edit, so upstream merges stay clean) and only
# swaps what is sent: a Nudges::PushPayload, which the service worker shows
# as it is (service_worker/web_push_notifications.js, `kronk_nudge`).
class Nudges::WebPushWorker < Web::PushNotificationWorker
  sidekiq_options queue: 'push', retry: 5

  def perform(subscription_id, kind, id)
    @subscription = Web::PushSubscription.find(subscription_id)
    @record = kind == 'message' ? Nudges::ConversationMessage.find(id) : Nudges::Event.find(id)

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

  def push_notification_json
    I18n.with_locale(@subscription.locale.presence || I18n.default_locale) do
      Oj.dump(Nudges::PushPayload.new(@record, recipient: @subscription.user.account).as_json)
    end
  end
end
