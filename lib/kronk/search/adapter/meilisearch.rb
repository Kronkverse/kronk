# frozen_string_literal: true

# Kronk::Search::Adapter::Meilisearch — talks to a Meilisearch instance.
#
# Config (env):
#   MEILISEARCH_URL      — e.g. http://localhost:7700
#   MEILI_MASTER_KEY     — the master key set on the Meilisearch container
#   SEARCH_BACKEND       — must be `meilisearch` for this adapter to be picked
#
# Index naming: `kronk_<type>` (`kronk_statuses`, `kronk_accounts`, ...).
# Per-index field configs live in `Kronk::Search::IndexConfigs` (PR 2).
#
# Errors are swallowed and logged rather than raised — a Meilisearch
# outage should never break user-facing writes (statuses, proposals,
# etc). Read-path errors fall through as an empty result set so the
# UI shows "no results" rather than 500.

require 'meilisearch'

module Kronk
  module Search
    class Adapter
      class Meilisearch < Adapter
        INDEX_PREFIX = 'kronk_'

        def initialize(client: nil)
          super()
          @client = client
        end

        def index(type, record)
          doc = serialize(type, record)
          return if doc.nil?

          index_for(type).add_documents([doc])
        rescue => e
          Rails.logger.warn("[kronk:search:meilisearch] index(#{type}, #{record&.id}) failed: #{e.class} #{e.message}")
        end

        def remove(type, record)
          return unless record&.id

          index_for(type).delete_document(record.id)
        rescue => e
          Rails.logger.warn("[kronk:search:meilisearch] remove(#{type}, #{record.id}) failed: #{e.class} #{e.message}")
        end

        def search(type:, query:, filters: {}, viewer: nil)
          opts = build_search_opts(filters, viewer)
          res = index_for(type).search(query, opts)
          hits = res.is_a?(Hash) ? res['hits'] : []
          Array(hits).map do |hit|
            { type: type.to_sym, id: hit['id'], score: hit['_rankingScore'], source: hit }
          end
        rescue => e
          Rails.logger.warn("[kronk:search:meilisearch] search(#{type}, #{query.inspect}) failed: #{e.class} #{e.message}")
          []
        end

        def reindex_all(type)
          # Placeholder — real implementation lives in PR 2's rake task,
          # which walks the model in batches and pushes documents. Left
          # here so the interface is complete.
          raise NotImplementedError, 'reindex_all is implemented in the PR 2 rake task, not the adapter'
        end

        private

        def client
          @client ||= ::MeiliSearch::Client.new(
            ENV.fetch('MEILISEARCH_URL'),
            ENV.fetch('MEILI_MASTER_KEY')
          )
        end

        def index_for(type)
          client.index("#{INDEX_PREFIX}#{type}")
        end

        # Serialization contract stubbed for PR 1. PR 2 fleshes this
        # out per-type against `Kronk::Search::IndexConfigs`; for now
        # the adapter carries a permissive default that lets the write
        # path exercise end-to-end against a live Meilisearch instance.
        def serialize(type, record)
          return nil unless record.respond_to?(:id) && record.id

          if record.respond_to?(:as_json_for_search)
            record.as_json_for_search
          else
            { id: record.id, type: type.to_s }
          end
        end

        def build_search_opts(filters, viewer)
          # Meilisearch's `filter:` param takes a string / array of
          # `field = 'value'` expressions. PR 2 layers real per-type
          # filter logic; PR 1 forwards nothing so the adapter is
          # complete but naïve.
          opts = { attributesToRetrieve: ['*'], showRankingScore: true }
          opts[:filter] = filters[:raw] if filters.is_a?(Hash) && filters[:raw]
          _ = viewer # policy filtering happens above the adapter (spec §7)
          opts
        end
      end
    end
  end
end
