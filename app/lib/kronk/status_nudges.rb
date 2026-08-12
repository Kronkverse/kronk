# frozen_string_literal: true

# Kronk::StatusNudges — publishes the "something happened to YOUR post" events
# onto the Kronk::KornerEvents bus, so they route through the nudges manifest's
# `listens:` block into the recipient's messenger.
#
# Scope (decisions.md 2026-08-12 "Notifications: own-content first"): a user is
# notified when anything happens with their content. Each of these has exactly
# ONE recipient — the author — which is why they need no fan-out machinery: they
# are Tier-1 **directed** events in the sense of docs/kronk_nudges.md
# § Relevance engine, and the manifest path has delivered those since #1367.
#
#   status.frothed    someone frothed your post
#   status.replied    someone replied to your post
#   status.mentioned  someone mentioned you
#
# `status.reblogged` is deliberately absent: #1407 retired Boost from the action
# bar, so there is no local path to boost, and federation is deferred — it would
# announce something that cannot happen. `status.quoted` is parked pending a
# decision on whether quoting is still reachable at all now that the
# BoostOrQuoteMenu is off the bar.
#
# Gated on `Kronk::FeatureFlags.status_nudges` so the new path can dual-run
# against the legacy `Notification` store and be compared on real traffic before
# anything is cut over (notification_retirement_plan.md phase 2). The legacy
# notification still fires either way — this only adds the nudge.
module Kronk
  module StatusNudges
    module_function

    # Publish a directed status event. Returns nil and does nothing when the
    # flag is off, when either account is missing, or when the actor IS the
    # recipient — nobody needs telling about their own froth. (EventRouter also
    # drops self-nudges; guarding here keeps pointless events off the bus.)
    def publish(event, actor_account_id:, recipient_account_id:, status_id:, **extra)
      return unless Kronk::FeatureFlags.enabled?(:status_nudges)
      return if actor_account_id.blank? || recipient_account_id.blank?
      return if actor_account_id == recipient_account_id

      Kronk::KornerEvents.publish(
        event,
        actor_account_id: actor_account_id,
        recipient_account_id: recipient_account_id,
        status_id: status_id,
        **extra
      )
    end
  end
end
