# frozen_string_literal: true

# Nudges::EventRouter — the delivery point for cross-korner nudges.
#
# When a korner publishes an event that would be a nudge to some
# account (e.g. `kommons.proposal.backed` → notify the proposal
# author), the router:
#
#   1. Filters out self-nudges (actor == recipient).
#   2. Filters out non-Mates (recipient and actor must be mutual
#      follows). Non-Mate nudges never land in Nudges per
#      docs/kronk_nudges.md §Amendments.
#   3. Finds or creates the Mate `Nudges::Conversation` between the
#      two accounts.
#   4. Writes a `Nudges::Event` on that conversation with the
#      source korner slug, verb, and (interactive-only) CTA — unless
#      `aggregate_window:` is set and a matching recent event already
#      exists, in which case the burst collapses onto that one event
#      (see #aggregable_event) rather than stacking N rows.
#
# The router NEVER stores korner data — only the reference
# (`source_type` + `source_id`). The renderer resolves the source
# lazily; a tombstoned source degrades gracefully.
#
#   Nudges::EventRouter.deliver(
#     actor: alice,
#     recipient: bob,
#     source_korner_slug: 'kommons',
#     verb: 'backed',
#     source_type: 'Proposal',
#     source_id: proposal.id,
#     interaction: 'interactive',
#     cta_label: 'View proposal',
#     cta_route: "/hub/kommons/p/#{proposal.id}",
#   )
module Nudges
  class EventRouter
    def self.deliver(**)
      new(**).call
    end

    def initialize(actor:, recipient:, source_korner_slug:, verb:,
                   source_type: nil, source_id: nil,
                   interaction: 'passive', cta_label: nil, cta_route: nil,
                   aggregate_window: nil)
      @actor              = actor
      @recipient          = recipient
      @source_korner_slug = source_korner_slug.to_s
      @verb               = verb.to_s
      @source_type        = source_type
      @source_id          = source_id
      @interaction        = interaction.to_s
      @cta_label          = cta_label
      @cta_route          = cta_route
      @aggregate_window   = aggregate_window
    end

    def call
      return :self_dropped     if self_nudge?
      return :non_mate_dropped unless mates?

      conversation = ensure_conversation

      if (existing = aggregable_event(conversation))
        return collapse_onto(existing)
      end

      conversation.events.create!(
        actor_account: @actor,
        source_korner_slug: @source_korner_slug,
        verb: @verb,
        source_type: @source_type,
        source_id: @source_id,
        interaction: @interaction,
        cta_label: interactive? ? @cta_label : nil,
        cta_route: interactive? ? @cta_route : nil
      )
    end

    private

    def self_nudge?
      @actor.id == @recipient.id
    end

    # The most recent event on this conversation that this delivery would
    # duplicate — same source ref and verb — still inside the aggregation
    # window. Present only when the caller asked for aggregation (the
    # manifest declared a window, resolved via Nudges::Aggregator.window_for)
    # and a match remains in-window; the burst then collapses onto this one
    # event instead of stacking N rows. The collapse key mirrors the
    # read-side Aggregator's subject identity — (source_type, source_id,
    # verb) — so for albutts `album_new_photo` it is (Album, album_id,
    # added_photo): exactly the manifest's `key: album_id`, actor-agnostic.
    def aggregable_event(conversation)
      return nil if @aggregate_window.nil?
      return nil if @source_type.blank? || @source_id.blank?

      conversation.events
                  .where(verb: @verb, source_type: @source_type, source_id: @source_id)
                  .where(Nudges::Event.arel_table[:created_at].gteq(@aggregate_window.ago))
                  .order(created_at: :desc)
                  .first
    end

    # Re-float the collapsed event to now and surface the latest actor, so
    # the burst reads as one fresh nudge rather than a stale row behind a
    # suppressed duplicate. created_at is the conversation stream's sort
    # key, so touching it moves the single row back to the top. We skip
    # validations/callbacks (update_columns) and re-publish by hand — the
    # after_create hooks only fire on insert, and this is deliberately not
    # an insert.
    def collapse_onto(event)
      now = Time.current
      event.update_columns(actor_account_id: @actor.id, created_at: now)
      event.conversation.update_column(:last_activity_at, now)
      Nudges::StreamPublisher.event_created(event)
      event
    end

    # Mates = mutual follow (canonical: Account#mate?). This is the
    # Mates-only privacy stance per amendment §Non-Mate nudges. A
    # follower-only relationship does not qualify.
    def mates?
      @actor.mate?(@recipient)
    end

    def ensure_conversation
      Nudges::Conversation.mate_between!(@actor, @recipient)
    end

    def interactive?
      @interaction == Nudges::Event::INTERACTIVE
    end
  end
end
