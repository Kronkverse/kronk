# frozen_string_literal: true

# Manifest-driven cross-korner event routing per impl plan §9.5.
# Reads the Nudges manifest's `listens:` block at boot and registers
# a `Kronk::KornerEvents.subscribe` for each declared event, using
# the entry's fields to build the `Nudges::EventRouter.deliver` call.
#
# Retires the hand-wired `nudges_event_router.rb` initializer. A new
# Nudges listener now takes a manifest edit + a source-side publish
# (in the emitting model) — no touch to this file.
#
# Special cases that don't fit the Mate-routed template stay
# hand-wired below (currently: `krews.member.joined` targets the
# Krew conversation itself, bypassing the Mates gate).

# Interpolate {token} placeholders in a string from a symbol-keyed
# payload. Returns the string unchanged if no tokens matched. Unknown
# tokens are left in place — surfaces obvious in logs / UI if a
# manifest declares a key the publisher didn't ship.
NUDGES_TEMPLATE = lambda do |template, payload|
  return nil if template.nil?

  template.gsub(/\{(\w+)\}/) do |match|
    key = Regexp.last_match(1).to_sym
    payload.key?(key) ? payload[key].to_s : match
  end
end

Rails.application.config.after_initialize do
  nudges = Kronk::KornerRegistry.find('nudges')
  next unless nudges

  nudges.listens.each do |entry|
    next unless entry.is_a?(Hash)

    event = entry['event']
    next unless event

    # A listen entry may declare `aggregation: { window: <Nm|Nh|Ns> }`. When it
    # does, a burst of the same event on the same subject collapses into a
    # single re-floating nudge per recipient within the window, instead of one
    # nudge per occurrence (see Nudges::EventRouter#aggregable_event). Resolved
    # once here and captured by the subscriber closure.
    aggregation = entry['aggregation']
    aggregate_window = (Nudges::Aggregator.parse_window(aggregation['window']) if aggregation.is_a?(Hash) && aggregation['window'])

    Kronk::KornerEvents.subscribe(event) do |payload|
      actor     = Account.find_by(id: payload[:actor_account_id])
      recipient = Account.find_by(id: payload[:recipient_account_id])
      next unless actor && recipient

      verb_template = entry['verb_template']
      verb = verb_template.present? ? NUDGES_TEMPLATE.call(verb_template, payload) : entry['verb']

      source_id = entry['source_id_key'].present? ? payload[entry['source_id_key'].to_sym] : nil

      Nudges::EventRouter.deliver(
        actor: actor,
        recipient: recipient,
        source_korner_slug: entry['source_korner'],
        verb: verb,
        source_type: entry['source_type'],
        source_id: source_id,
        interaction: entry['interaction'] || 'passive',
        cta_label: NUDGES_TEMPLATE.call(entry['cta_label'], payload),
        cta_route: NUDGES_TEMPLATE.call(entry['cta_route'], payload),
        aggregate_window: aggregate_window
      )
    end
  end

  # ── Hand-wired: krews.member.joined ──────────────────────────────
  # Different flow from the manifest-driven Mate routes: the target
  # is the Krew conversation itself, not a 1:1 Mate chat, so the
  # Mates gate doesn't apply. Ensures the Krew conversation exists,
  # adds the account to its memberships, and drops a `joined`
  # system-line event onto the stream.
  Kronk::KornerEvents.subscribe('krews.member.joined') do |payload|
    krew  = Krew.find_by(id: payload[:krew_id])
    actor = Account.find_by(id: payload[:actor_account_id])
    next unless krew && actor

    convo = Nudges::Conversation.krew_for!(krew)
    convo.memberships.find_or_create_by!(account_id: actor.id) do |m|
      m.joined_at = Time.current
    end
    convo.events.create!(
      actor_account: actor,
      source_korner_slug: 'krew',
      verb: 'joined',
      interaction: 'passive'
    )
  end

  # ── Hand-wired: krews.member.left ────────────────────────────────
  # Cleans up ConversationMembership when an account leaves the
  # underlying Krew (via either the Krew leave endpoint or Nudges'
  # own Krew leave). Idempotent: destroys 0 or 1 rows depending on
  # who fired first. No system-line event: leaving is a private
  # signal, not a room announcement.
  Kronk::KornerEvents.subscribe('krews.member.left') do |payload|
    convo = Nudges::Conversation.find_by(kind: Nudges::Conversation::KREW, krew_id: payload[:krew_id])
    next unless convo

    convo.memberships.where(account_id: payload[:actor_account_id]).destroy_all
  end

  # ── Hand-wired: albutts.album.new_photo ──────────────────────────
  # Multi-recipient fan-out: every fellow contributor gets a nudge
  # (docs/spaces/albutts.md §Notifications). The Mate gate still
  # applies per recipient; a contribution burst reaching non-mates
  # silently drops those legs. Aggregation (`window: 15m,
  # key: album_id`) declared on the `album_new_photo` type is honoured
  # by passing the manifest window to the router: a burst of photos to
  # one album collapses into a single nudge per recipient (keyed on the
  # Album source ref) instead of one nudge per photo.
  Kronk::KornerEvents.subscribe('albutts.album.new_photo') do |payload|
    album = Album.find_by(id: payload[:album_id])
    actor = Account.find_by(id: payload[:actor_account_id])
    next unless album && actor

    aggregate_window = Nudges::Aggregator.window_for('album_new_photo', korner_slug: 'albutts')

    fellow_ids = album.photos.where.not(contributor_id: actor.id)
                      .distinct.pluck(:contributor_id)
    fellow_ids |= [album.owner_id] unless album.owner_id == actor.id

    fellow_ids.each do |recipient_id|
      recipient = Account.find_by(id: recipient_id)
      next unless recipient

      Nudges::EventRouter.deliver(
        actor: actor,
        recipient: recipient,
        source_korner_slug: 'albutts',
        verb: 'added_photo',
        source_type: 'Album',
        source_id: album.id,
        interaction: 'interactive',
        cta_label: 'View album',
        cta_route: "/hub/albutts/albums/#{album.id}",
        aggregate_window: aggregate_window
      )
    end
  end

  # `albutts.photo.frothed` and `albutts.photo.commented` retired
  # 2026-07-31 with the Status-backed refactor. Per-photo favourites
  # and replies now flow through the standard Status notification
  # pipeline (Favourite / Notification records), so no bespoke
  # subscribe is needed here.

  # ── Hand-wired: mates.request.sent + mates.request.accepted ─────
  # A mate request is inherently non-Mate — the two accounts are
  # not mutual yet, that's the whole point — so the standard
  # `Nudges::EventRouter` (which requires Mates) would drop these
  # as `:non_mate_dropped`. Route them straight onto the Mate
  # conversation between the pair (which `mate_between!` creates
  # on demand and reuses once they accept), so the requester's
  # invite lands in the target's messenger, and the accept lands
  # back in the requester's.
  Kronk::KornerEvents.subscribe('mates.request.sent') do |payload|
    actor     = Account.find_by(id: payload[:actor_account_id])
    recipient = Account.find_by(id: payload[:recipient_account_id])
    next unless actor && recipient

    convo = Nudges::Conversation.mate_between!(actor, recipient)
    convo.events.create!(
      actor_account: actor,
      source_korner_slug: 'mates',
      verb: 'mate_requested',
      interaction: Nudges::Event::INTERACTIVE,
      cta_label: 'Respond',
      cta_route: '/mate_requests'
    )
  end

  Kronk::KornerEvents.subscribe('mates.request.accepted') do |payload|
    actor     = Account.find_by(id: payload[:actor_account_id])
    recipient = Account.find_by(id: payload[:recipient_account_id])
    next unless actor && recipient

    convo = Nudges::Conversation.mate_between!(actor, recipient)
    convo.events.create!(
      actor_account: actor,
      source_korner_slug: 'mates',
      verb: 'mate_accepted',
      interaction: Nudges::Event::INTERACTIVE,
      cta_label: 'Say hi',
      cta_route: "/nudges/#{actor.id}"
    )
  end
end
