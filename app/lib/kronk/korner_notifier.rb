# frozen_string_literal: true

# Kronk::KornerNotifier — the one place a korner turns a domain event into a
# notification. Korner notifications are system-ish: the actor is a real
# account, but the delivery bypasses NotifyService (which assumes a social
# sender + follow graph and raises on korner activity types). This mirrors the
# direct-create pattern proposal_status_changed already uses in
# Kronk::ProposalStates, centralised so every producer shares the same guards
# and the same fire-and-forget rescue — a notification failure must never roll
# back the domain transaction that triggered it.
#
#   Kronk::KornerNotifier.notify(
#     recipient_id: proposal.created_by_account_id,
#     from_account: current_account,
#     activity: proposal,
#     type: 'proposal_challenged'
#   )
#
# The `type` must be a registered Notification type (Notification::TYPES); the
# korners doctor L10 gate enforces that a manifest only declares types that are.
module Kronk
  module KornerNotifier
    module_function

    def notify(recipient_id:, from_account:, activity:, type:)
      return if recipient_id.blank? || from_account.nil? || activity.nil?
      # No self-notification — the actor doesn't need telling about their own act.
      return if recipient_id == from_account.id

      Notification.create!(
        account_id: recipient_id,
        from_account: from_account,
        activity: activity,
        type: type
      )
    rescue StandardError => e
      Rails.logger.error("[kronk:notify:#{type}] failed for recipient #{recipient_id}: #{e.class} #{e.message}")
      nil
    end
  end
end
