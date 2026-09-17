# frozen_string_literal: true

# The one korner-specific seam in the otherwise-standardised seen plumbing
# (Kronk::KornerSeen). A content-stream adapter knows two things about a korner:
#   * #unread_relation(viewer, baseline, seen_ids) — the korner's items the
#     viewer would actually see in their feed, above the baseline and not yet
#     individually seen, excluding the viewer's own posts.
#   * #newest_id(viewer) — the id to advance the baseline to when the viewer
#     opens the korner ("mark everything up to now seen").
#
# Almost every korner is status-backed (its writer stamps
# `statuses.source_korner`), so the default SourceKornerStream covers them all
# for free — a new korner joins the unread system the moment it stamps that
# column, with no code here. Moments is the sole exception (no backing Status),
# so it gets an override.
#
# "Feed-visible" mirrors the home-feed write path
# (FanOutOnWriteService#fan_out_to_local_recipients!):
#   * public/unlisted/private posts reach one-way followers;
#   * mates/orbit posts reach mutual Mates only (NOT one-way followers — lumping
#     them into the follow set would leak mates-only posts);
#   * self_only reaches nobody; replies are excluded from home.
# Per-row mutes/blocks/keyword filters are intentionally not modelled here (an
# accepted approximation), and krew-scoped posts are a known slight under-count
# (see Layer 8 hardening).
module Kronk
  module KornerContentStreams
    module_function

    def for(slug)
      slug = slug.to_s
      builder = OVERRIDES[slug]
      builder ? builder.call : SourceKornerStream.new(slug)
    end

    # Default adapter: a korner whose items are Statuses tagged with
    # `source_korner = slug`.
    class SourceKornerStream
      def initialize(slug)
        @slug = slug.to_s
      end

      def unread_relation(viewer, baseline, seen_ids)
        base_scope
          .where(Status.arel_table[:id].gt(baseline.to_i))
          .where.not(id: Array(seen_ids))
          .where.not(account_id: viewer.id)
          .not_reply
          .merge(feed_visible_to(viewer))
      end

      def newest_id(_viewer)
        # Global newest — opening a korner catches you up on everything posted so
        # far. Items you can't see are harmless below the baseline (never counted).
        base_scope.maximum(:id).to_i
      end

      private

      def base_scope
        Status.where(source_korner: @slug)
      end

      # (from a followee, public-tier) OR (from a Mate, mates/orbit-tier).
      def feed_visible_to(viewer)
        following = Follow.where(account_id: viewer.id).select(:target_account_id)
        mates     = viewer.mates.select(:id)

        Status.where(account_id: following, visibility: %i(public unlisted private))
              .or(Status.where(account_id: mates, visibility: %i(mates orbit)))
      end
    end

    # Moments has no backing Status, so it streams its own rows. Same feed-visible
    # shape, keyed on `moments.id`, restricted to still-live moments. Moment's
    # visibility enum omits the unlisted/private tiers, so the public branch is
    # just `:public`.
    class MomentStream
      def unread_relation(viewer, baseline, seen_ids)
        base_scope
          .where(Moment.arel_table[:id].gt(baseline.to_i))
          .where.not(id: Array(seen_ids))
          .where.not(account_id: viewer.id)
          .merge(feed_visible_to(viewer))
      end

      def newest_id(_viewer)
        base_scope.maximum(:id).to_i
      end

      private

      def base_scope
        Moment.active
      end

      def feed_visible_to(viewer)
        following = Follow.where(account_id: viewer.id).select(:target_account_id)
        mates     = viewer.mates.select(:id)

        Moment.where(account_id: following, visibility: :public)
              .or(Moment.where(account_id: mates, visibility: %i(mates orbit)))
      end
    end

    OVERRIDES = {
      'moments' => -> { MomentStream.new },
    }.freeze
  end
end
