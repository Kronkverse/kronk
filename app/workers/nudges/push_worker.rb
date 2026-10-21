# frozen_string_literal: true

# Nudges::PushWorker — sends a new notification or chat message to the
# phones of the people it is for. docs/spaces/nudges.md (Push).
#
# Who: a notification's recipient; a message's other participants (the
# other Mate, or a Krew chat's members who have joined and not muted it).
# Each is skipped if they turned the row off (Nudges::PushPreferences) or
# are in their quiet hours (Nudges::QuietHours). Mutes were already applied
# when the nudge was delivered. One Nudges::WebPushWorker per subscription.
class Nudges::PushWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'push', retry: 2

  def perform(kind, id)
    @kind = kind
    @record = kind == 'message' ? Nudges::ConversationMessage.find_by(id: id) : Nudges::Event.find_by(id: id)
    return if @record.nil?

    recipients.each do |account|
      user = account.user
      next unless user&.functional?
      next unless Nudges::PushPreferences.push?(user, row_key)
      next if Nudges::QuietHours.silent_for?(user)

      ids = Web::PushSubscription.where(user_id: user.id).pluck(:id)
      Nudges::WebPushWorker.push_bulk(ids) { |subscription_id| [subscription_id, @kind, @record.id] }
    end
  end

  private

  def recipients
    return [@record.recipient_account].compact if @kind == 'event'

    conversation = @record.conversation
    return [] if conversation.nil? || conversation.expired?

    accounts = if conversation.mate?
                 [conversation.other_account_for(@record.author_account)]
               else
                 conversation.memberships.active.where(muted: false).includes(:account).map(&:account)
               end
    accounts.compact.reject { |account| account.id == @record.author_account_id }
  end

  def row_key
    return @record.conversation.krew? ? 'messages.krew' : 'messages.mate' if @kind == 'message'

    Nudges::MuteCatalogue.key_for(@record.source_korner_slug, @record.verb)
  end
end
