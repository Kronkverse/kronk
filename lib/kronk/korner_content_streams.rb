# frozen_string_literal: true

# The one korner-specific seam in the otherwise-standardised seen plumbing
# (Kronk::KornerSeen). A content-stream adapter knows three things about a
# korner:
#   * #unread_relation(viewer, baseline, seen_ids) — the korner's updates the
#     viewer would actually see in their feed, above the baseline and not yet
#     individually seen, excluding the viewer's own posts.
#   * #newest_id(viewer) — the id to advance the baseline to when the viewer
#     opens the korner ("mark everything up to now seen").
#   * #starting_baseline(viewer) — where the count starts for a korner the
#     viewer has never opened: when they joined, not everything ever posted.
#
# A badge counts updates, not posts (docs/decisions.md, 2026-10-19; Hub doc,
# Updates). A hidden post (an album photo's, a Moment's, an answer's) is never
# an update, and a korner can drop updates that no longer matter (Kalendar:
# events that are over).
#
# Almost every korner is status-backed (its writer stamps
# `statuses.source_korner`), so the default SourceKornerStream covers them all
# for free — a new korner joins the unread system the moment it stamps that
# column, with no code here. Moments and Kommunity have no backing Status, so
# they get overrides (Kommunity's updates are new members).
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
        still_counting(base_scope)
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

      def starting_baseline(viewer)
        Mastodon::Snowflake.id_at(viewer.created_at, with_random: false)
      end

      private

      def base_scope
        Status.where(source_korner: @slug).without_kronk_backing_posts
      end

      # The updates still worth a number. Every one, unless a korner says
      # otherwise.
      def still_counting(scope)
        scope
      end

      # (from a followee, public-tier) OR (from a Mate, mates/orbit-tier).
      def feed_visible_to(viewer)
        following = Follow.where(account_id: viewer.id).select(:target_account_id)
        mates     = viewer.mates.select(:id)

        Status.where(account_id: following, visibility: %i(public unlisted private))
              .or(Status.where(account_id: mates, visibility: %i(mates orbit)))
      end
    end

    # Kalendar: an event counts until it is over. A cancelled one doesn't.
    class KalendarStream < SourceKornerStream
      def initialize
        super('kalendar')
      end

      private

      def still_counting(scope)
        live = Event.where(cancelled: false)
                    .where('COALESCE(events.end_time, events.start_time) >= ?', Time.current)
        scope.where(id: live.select(:status_id))
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

      # Moment ids are a plain sequence, not time-based, and a Moment only
      # lives a day, so a first visit counts every live one.
      def starting_baseline(_viewer)
        0
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

    # Kommunity has no posts: its update is someone new you could find there,
    # a member who joined since you last looked. Who you could find follows
    # their own choice (Account.kommunity_discoverable_to), so a person who
    # keeps to their Orbit only counts for the people in it. Account ids are
    # time-based, so the baseline works as it does for posts.
    class KommunityStream
      def unread_relation(viewer, baseline, seen_ids)
        Account.kommunity_discoverable_to(viewer)
               .where(Account.arel_table[:id].gt(baseline.to_i))
               .where.not(id: Array(seen_ids))
      end

      # Global newest, as for posts: people you can't find are harmless
      # below the baseline. Also runs at sign-up (Account#seed_korner_seen_baselines).
      def newest_id(_viewer)
        Account.local.maximum(:id).to_i
      end

      def starting_baseline(viewer)
        Mastodon::Snowflake.id_at(viewer.created_at, with_random: false)
      end
    end

    OVERRIDES = {
      'moments' => -> { MomentStream.new },
      'kalendar' => -> { KalendarStream.new },
      'kommunity' => -> { KommunityStream.new },
    }.freeze
  end
end
