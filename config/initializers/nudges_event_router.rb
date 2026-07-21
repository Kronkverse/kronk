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

# Small helper — every subscriber does the same
# resolve-accounts-or-drop dance before delegating to the router.
# Kept local; if this pattern proliferates further the whole init
# file will retire in favour of manifest-driven auto-subscription
# (implementation plan §9.5).
NUDGE_ROUTE = lambda do |payload, **kwargs|
  actor     = Account.find_by(id: payload[:actor_account_id])
  recipient = Account.find_by(id: payload[:recipient_account_id])
  return unless actor && recipient

  Nudges::EventRouter.deliver(actor: actor, recipient: recipient, **kwargs)
end

Rails.application.config.after_initialize do
  # ── Kommons: proposal backing ────────────────────────────────────
  # Someone stakes tokens on a proposal → the proposal author gets a
  # nudge if the backer is a Mate.
  Kronk::KornerEvents.subscribe('kommons.proposal.backed') do |payload|
    NUDGE_ROUTE.call(
      payload,
      source_korner_slug: 'kommons',
      verb: 'backed',
      source_type: 'Proposal',
      source_id: payload[:proposal_id],
      interaction: 'interactive',
      cta_label: 'View proposal',
      cta_route: "/hub/kommons/p/#{payload[:proposal_id]}"
    )
  end

  # ── Kalendar: someone RSVPed to an event ─────────────────────────
  # The event creator gets a nudge if the RSVPer is a Mate. Passive
  # (informational — the creator sees the count elsewhere; the CTA
  # jumps to the event detail if they want the guest list).
  Kronk::KornerEvents.subscribe('kalendar.event.rsvpd') do |payload|
    NUDGE_ROUTE.call(
      payload,
      source_korner_slug: 'kalendar',
      verb: "rsvpd_#{payload[:status]}", # e.g. rsvpd_going
      source_type: 'Event',
      source_id: payload[:event_id],
      interaction: 'interactive',
      cta_label: 'View event',
      cta_route: "/hub/kalendar/#{payload[:event_id]}"
    )
  end

  # ── Wachuneed: buyer made an offer on a listing ──────────────────
  # The seller gets a nudge if the offerer is a Mate. Interactive —
  # the seller may accept, counter, or decline; CTA jumps to the
  # listing detail (offer inbox is a follow-up).
  Kronk::KornerEvents.subscribe('wachuneed.offer.made') do |payload|
    NUDGE_ROUTE.call(
      payload,
      source_korner_slug: 'wachuneed',
      verb: 'offered',
      source_type: 'Listing',
      source_id: payload[:listing_id],
      interaction: 'interactive',
      cta_label: 'View offer',
      cta_route: "/hub/wachuneed/listings/#{payload[:listing_id]}"
    )
  end

  # ── Kuestions: someone answered a Question ───────────────────────
  # The asker gets a nudge if the answerer is a Mate. Interactive —
  # the asker wants to read the answer.
  Kronk::KornerEvents.subscribe('kuestions.question.answered') do |payload|
    NUDGE_ROUTE.call(
      payload,
      source_korner_slug: 'kuestions',
      verb: 'answered',
      source_type: 'Question',
      source_id: payload[:question_id],
      interaction: 'interactive',
      cta_label: 'View answer',
      cta_route: "/hub/kuestions/q/#{payload[:question_id]}"
    )
  end

  # ── Booth: a Favourite landed on a set's shared Status ───────────
  # The set creator gets a nudge if the frother is a Mate. Passive
  # — a froth is an appreciation signal; no direct action required.
  # CTA still opens the set page for a curious click-through.
  Kronk::KornerEvents.subscribe('booth.set.frothed') do |payload|
    NUDGE_ROUTE.call(
      payload,
      source_korner_slug: 'booth',
      verb: 'frothed',
      source_type: 'BoothSet',
      source_id: payload[:booth_set_id],
      interaction: 'passive'
    )
  end

  # ── Wachuneed: seller accepted a buyer's offer ───────────────────
  # The buyer gets a nudge if the seller is a Mate. Interactive —
  # buyer needs to complete the deal. CTA jumps to the listing.
  Kronk::KornerEvents.subscribe('wachuneed.offer.accepted') do |payload|
    NUDGE_ROUTE.call(
      payload,
      source_korner_slug: 'wachuneed',
      verb: 'offer_accepted',
      source_type: 'Listing',
      source_id: payload[:listing_id],
      interaction: 'interactive',
      cta_label: 'View listing',
      cta_route: "/hub/wachuneed/listings/#{payload[:listing_id]}"
    )
  end

  # ── Wachuneed: seller declined a buyer's offer ───────────────────
  # The buyer gets a nudge if the seller is a Mate. Passive — the
  # answer is no; no further action expected here.
  Kronk::KornerEvents.subscribe('wachuneed.offer.declined') do |payload|
    NUDGE_ROUTE.call(
      payload,
      source_korner_slug: 'wachuneed',
      verb: 'offer_declined',
      source_type: 'Listing',
      source_id: payload[:listing_id],
      interaction: 'passive'
    )
  end
end
