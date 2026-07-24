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
#      source korner slug, verb, and (interactive-only) CTA.
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
                   interaction: 'passive', cta_label: nil, cta_route: nil)
      @actor              = actor
      @recipient          = recipient
      @source_korner_slug = source_korner_slug.to_s
      @verb               = verb.to_s
      @source_type        = source_type
      @source_id          = source_id
      @interaction        = interaction.to_s
      @cta_label          = cta_label
      @cta_route          = cta_route
    end

    def call
      return :self_dropped     if self_nudge?
      return :non_mate_dropped unless mates?

      conversation = ensure_conversation
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
