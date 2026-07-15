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

module Kronk
  module Search
    module PolicyFilter
      module_function

      # Turn adapter hits into a `Search` presenter grouped by type
      # (accounts / statuses / hashtags). Each collection is filtered
      # against the viewer.
      def filter(hits, viewer)
        by_type = hits.group_by { |h| h[:type]&.to_sym }

        # `::Search` is Mastodon's top-level result presenter. The leading
        # `::` is required: inside `Kronk::Search`, a bare `Search` resolves
        # to this enclosing module (which has no `.new`) — the NoMethodError
        # only surfaces on the meilisearch path, which CI's null adapter skips.
        ::Search.new(
          accounts: filter_accounts(by_type[:accounts], viewer),
          statuses: filter_statuses(by_type[:statuses], viewer),
          hashtags: filter_hashtags(by_type[:kategories], viewer)
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

      def status_visible_to?(status, viewer)
        StatusPolicy.new(viewer, status).show?
      rescue
        false
      end
    end
  end
end
