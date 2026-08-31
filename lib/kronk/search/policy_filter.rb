# frozen_string_literal: true

# Kronk::Search::PolicyFilter — runs adapter hits through the §7
# policy layer.
#
# Adapter returns a raw stream of `{ type:, id:, score:, source: }`
# hits from Meilisearch. The index is a **superset** — it doesn't
# know about visibility, block relationships, tune-out state, or
# instance-level suspension. This filter loads each hit through
# ActiveRecord and gates it through the right Policy before the hit
# leaves the search response.
#
# The result is guaranteed: a viewer never sees a search result they
# couldn't see via the feed.
#
# Beyond the three Mastodon-native types (accounts / statuses /
# hashtags), the five Kronk-native types below are also filtered +
# projected here into a plain `{id, korner, title, subtitle, url}`
# hash per hit. Skipping serializers keeps the shape uniform across
# types and lets the SPA render a generic result row per korner
# without loading a full REST serializer for each.
#
# `nudge_messages` is deliberately NOT surfaced here — nudge threads
# are DMs; a universal-search reveal would break the privacy contract
# the messenger relies on. Their index is kept for a possible
# per-thread search UI later.

module Kronk
  module Search
    module PolicyFilter
      module_function

      # Turn adapter hits into a Kronk::SearchResults presenter grouped
      # by type. Each collection is filtered against the viewer.
      def filter(hits, viewer)
        by_type = hits.group_by { |h| h[:type]&.to_sym }

        Kronk::SearchResults.new(
          accounts: filter_accounts(by_type[:accounts], viewer),
          statuses: filter_statuses(by_type[:statuses], viewer),
          hashtags: filter_hashtags(by_type[:kategories], viewer),
          events: filter_events(by_type[:kalendar_events], viewer),
          proposals: filter_proposals(by_type[:kommons_proposals], viewer),
          booth_sets: filter_booth_sets(by_type[:booth_sets], viewer),
          listings: filter_listings(by_type[:wachuneed_listings], viewer),
          krews: filter_krews(by_type[:krews], viewer)
        )
      end

      def filter_accounts(hits, viewer)
        return [] if hits.blank?

        ids = hits.pluck(:id)
        scope = Account.where(id: ids).where(suspended_at: nil).where(silenced_at: nil).or(Account.where(id: viewer&.id))

        # Preserve adapter ranking order.
        ordered = scope.index_by(&:id)
        ids.filter_map { |id| ordered[id.to_i] || ordered[id.to_s] }
      end

      def filter_statuses(hits, viewer)
        return [] if hits.blank?

        ids = hits.pluck(:id)
        # Load in one query, then per-status permission gate.
        by_id = Status.where(id: ids).includes(:account, :tags).index_by(&:id)

        ids.filter_map do |id|
          record = by_id[id.to_i] || by_id[id.to_s]
          next unless record
          next unless status_visible_to?(record, viewer)

          record
        end
      end

      def filter_hashtags(hits, viewer)
        return [] if hits.blank?

        ids = hits.pluck(:id)
        # Kategories are curated (public by definition) — no per-viewer gate.
        Tag.where(id: ids).where(curated: true).to_a.tap do |tags|
          # Preserve adapter order.
          by_id = tags.index_by(&:id)
          return ids.filter_map { |id| by_id[id.to_i] || by_id[id.to_s] }
        end
        _ = viewer # explicit "not used" marker
      end

      # ── Kronk-native collections ─────────────────────────────────
      # Each returns a plain-hash projection so the response shape is
      # uniform across types — the SPA reads {id, korner, title,
      # subtitle, url} and doesn't need to know each korner's REST
      # serializer.

      def filter_events(hits, viewer)
        return [] if hits.blank?

        ids = hits.pluck(:id)
        by_id = Event.where(id: ids).includes(:account).index_by(&:id)
        ids.filter_map do |id|
          record = by_id[id.to_i] || by_id[id.to_s]
          next unless record
          next unless record.visible_to?(viewer)

          project_event(record)
        end
      end

      def filter_proposals(hits, viewer)
        return [] if hits.blank?

        ids = hits.pluck(:id)
        by_id = Proposal.where(id: ids).includes(:discussion).index_by(&:id)
        ids.filter_map do |id|
          record = by_id[id.to_i] || by_id[id.to_s]
          next unless record
          next unless proposal_visible_to?(record, viewer)

          project_proposal(record)
        end
      end

      def filter_booth_sets(hits, viewer)
        return [] if hits.blank?

        ids = hits.pluck(:id)
        # Only published sets surface; the index is a superset so we
        # gate here rather than relying on it.
        by_id = BoothSet.where(id: ids).published.includes(:account, :status).index_by(&:id)
        ids.filter_map do |id|
          record = by_id[id.to_i] || by_id[id.to_s]
          next unless record
          next unless booth_set_visible_to?(record, viewer)

          project_booth_set(record)
        end
      end

      def filter_listings(hits, viewer)
        return [] if hits.blank?

        ids = hits.pluck(:id)
        # Live + reserved surface; drafts and closed listings don't.
        by_id = Listing.where(id: ids, state: %w(live reserved)).includes(:status).index_by(&:id)
        ids.filter_map do |id|
          record = by_id[id.to_i] || by_id[id.to_s]
          next unless record
          next unless listing_visible_to?(record, viewer)

          project_listing(record)
        end
      end

      def filter_krews(hits, viewer)
        return [] if hits.blank?

        ids = hits.pluck(:id)
        # Krews are indexed conditionally on `discoverable?` (see
        # krew.rb `searchable_as :krews, if: :discoverable?`), but the
        # `discoverable` bit can flip after the doc lands — re-check
        # here to keep the response honest.
        by_id = Krew.where(id: ids).discoverable.index_by(&:id)
        ids.filter_map do |id|
          record = by_id[id.to_i] || by_id[id.to_s]
          next unless record

          project_krew(record)
        end
        _ = viewer # discoverable krews are visible to everyone
      end

      # ── Visibility gates ─────────────────────────────────────────

      def status_visible_to?(status, viewer)
        StatusPolicy.new(viewer, status).show?
      rescue
        false
      end

      def proposal_visible_to?(proposal, viewer)
        # Kommons proposals fan out via their attached `discussion`
        # Status. If no discussion is attached the proposal is
        # effectively author-owned and only surfaces to the author.
        discussion = proposal.discussion
        return proposal.created_by_account_id == viewer&.id if discussion.nil?

        status_visible_to?(discussion, viewer)
      end

      def booth_set_visible_to?(set, viewer)
        # Booth sets fan out via their Status the same way. A set
        # without a status is author-owned.
        status = set.status
        return set.account_id == viewer&.id if status.nil?

        status_visible_to?(status, viewer)
      end

      def listing_visible_to?(listing, viewer)
        status = listing.status
        return listing.account_id == viewer&.id if status.nil?

        status_visible_to?(status, viewer)
      end

      # ── Projections ──────────────────────────────────────────────

      def project_event(record)
        subtitle_parts = []
        subtitle_parts << record.start_time.strftime('%a %-d %b %H:%M') if record.start_time
        subtitle_parts << record.location_name if record.location_name.present?
        {
          id: record.id.to_s,
          korner: 'kalendar',
          title: record.title.to_s,
          subtitle: subtitle_parts.join(' · ').presence,
          url: "/kalendar/#{record.slug.presence || record.id}",
        }
      end

      def project_proposal(record)
        {
          id: record.id.to_s,
          korner: 'kommons',
          title: record.title.to_s,
          subtitle: truncate(record.summary.presence || record.body.to_s),
          url: "/hub/kommons/p/#{record.id}",
        }
      end

      def project_booth_set(record)
        subtitle = record.artist_name.present? ? "by #{record.artist_name}" : record.genre.presence
        {
          id: record.id.to_s,
          korner: 'booth',
          title: record.title.to_s,
          subtitle: subtitle,
          url: "/hub/booth/sets/#{record.id}",
        }
      end

      def project_listing(record)
        {
          id: record.id.to_s,
          korner: 'martketplace',
          title: record.title.to_s,
          subtitle: [record.category.presence, record.subcategory.presence].compact.join(' · ').presence,
          # No per-listing detail route yet — link to the Wachuneed list.
          # Follow-up when the detail page ships.
          url: '/hub/martketplace',
        }
      end

      def project_krew(record)
        {
          id: record.id.to_s,
          korner: 'krew',
          title: record.name.to_s,
          subtitle: truncate(record.description.to_s),
          url: "/hub/krew/#{record.slug.presence || record.id}",
        }
      end

      # Trim a description-ish string to a search-result-friendly length
      # without breaking mid-word if we can help it.
      def truncate(text, limit: 100)
        stripped = text.to_s.strip
        return nil if stripped.empty?
        return stripped if stripped.length <= limit

        cut = stripped[0, limit]
        last_space = cut.rindex(' ')
        "#{last_space && last_space > limit / 2 ? cut[0, last_space] : cut}…"
      end
    end
  end
end
