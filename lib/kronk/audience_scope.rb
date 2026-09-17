# frozen_string_literal: true

module Kronk
  # AudienceScope — the shared Me -> Mates -> Orbit -> Kronk audience ladder.
  #
  # This is the read-time filter that narrows a feed to a chosen audience width.
  # It reuses the canonical relationship primitives (Account#mates, built on
  # mutual follows) rather than re-deriving them, so every surface that adopts
  # the ladder agrees on what "mates" means.
  #
  # The tiers, innermost to widest:
  #   * me       — the viewer's own content
  #   * mates    — the viewer's mates (mutual follows), plus the viewer's own
  #   * orbit    — the viewer's whole home graph (no narrowing here)
  #   * kommunity — everyone local (served by a different timeline upstream)
  #
  # Only `me` and `mates` narrow a status collection; `orbit` is the unfiltered
  # default and `kommunity` is a separate feed, so both pass through. A nil
  # viewer or an unknown tier also passes through unchanged. Call sites gate this
  # behind Kronk::FeatureFlags.feed_scope_enforced, so the read path is unchanged
  # until the flag is flipped.
  module AudienceScope
    TIERS = %w(me mates orbit kommunity).freeze

    module_function

    # Narrow an ordered array of Status records to `tier` from `viewer`'s
    # perspective, preserving order. Reblogs are judged by the reblogger's
    # account (status.account_id) - a mate's reblog counts as the mate's
    # activity, which is what the ladder means by "whose feed you're seeing".
    def filter_statuses(viewer, statuses, tier)
      return statuses if viewer.nil?

      case tier.to_s
      when 'me'
        statuses.select { |status| status.account_id == viewer.id }
      when 'mates'
        allowed = mate_ids_within(viewer, statuses)
        allowed << viewer.id
        statuses.select { |status| allowed.include?(status.account_id) }
      else
        statuses
      end
    end

    # The subset of the page's author ids that are mates of the viewer, as a Set.
    # Scoped to the ids actually present so it's one indexed query per page, not
    # a load of the viewer's entire mate set.
    def mate_ids_within(viewer, statuses)
      author_ids = statuses.map(&:account_id).uniq
      return Set.new if author_ids.empty?

      viewer.mates.where(id: author_ids).pluck(:id).to_set
    end
  end
end
