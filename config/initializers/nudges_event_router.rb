# frozen_string_literal: true

# Nudges event routing — subscribes the Nudges korner to the
# cross-korner event bus and lands each event as a `Nudges::Event`
# row on the recipient's Mate conversation with the actor.
#
# This initializer is a temporary hand-wiring; when the manifest-
# driven bus wiring lands (implementation plan Phase 9.5), each
# korner's `listens:` block registers its subscribers automatically
# and this file retires.
#
# One subscriber per emit; each is a thin adapter that resolves the
# accounts + source object and delegates to `Nudges::EventRouter`.

Rails.application.config.after_initialize do
  # ── Kommons: proposal backing ────────────────────────────────────
  # Someone stakes tokens on a proposal → the proposal author gets a
  # nudge if the backer is a Mate.
  Kronk::KornerEvents.subscribe('kommons.proposal.backed') do |payload|
    actor     = Account.find_by(id: payload[:actor_account_id])
    recipient = Account.find_by(id: payload[:recipient_account_id])
    next unless actor && recipient

    Nudges::EventRouter.deliver(
      actor: actor,
      recipient: recipient,
      source_korner_slug: 'kommons',
      verb: 'backed',
      source_type: 'Proposal',
      source_id: payload[:proposal_id],
      interaction: 'interactive',
      cta_label: 'View proposal',
      cta_route: "/hub/kommons/p/#{payload[:proposal_id]}"
    )
  end
end
