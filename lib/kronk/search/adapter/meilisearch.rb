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

        def reindex_all(type, model)
          configure_index(type)
          index = index_for(type)
          batch_size = 500
          total = 0

          scope = model.respond_to?(:reindex_scope) ? model.reindex_scope : model.all
          scope.find_in_batches(batch_size: batch_size) do |batch|
            docs = batch.filter_map do |record|
              serialize(type, record) if satisfies_condition?(record)
            end
            index.add_documents(docs) if docs.any?
            total += docs.size
            Rails.logger.info("[kronk:search:meilisearch] reindexed #{total} #{type}…")
          end
          Rails.logger.info("[kronk:search:meilisearch] reindex_all(#{type}) complete: #{total} documents")
          total
        rescue => e
          Rails.logger.warn("[kronk:search:meilisearch] reindex_all(#{type}) failed: #{e.class} #{e.message}")
          nil
        end

        # Push index settings (searchable / filterable / sortable
        # attributes) from Kronk::Search::IndexConfigs. Idempotent —
        # Meilisearch merges settings. Called by the rake task; safe
        # to call at any time.
        def configure_index(type)
          config = Kronk::Search::IndexConfigs.for(type)
          return if config.empty?

          settings = {
            searchableAttributes: config[:searchable_attributes],
            filterableAttributes: config[:filterable_attributes],
            sortableAttributes: config[:sortable_attributes],
          }.compact
          index_for(type).update_settings(settings)
        rescue => e
          Rails.logger.warn("[kronk:search:meilisearch] configure_index(#{type}) failed: #{e.class} #{e.message}")
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

        # Turn a record into the document Meilisearch stores. Models
        # override `#as_json_for_search` to declare their per-type
        # field shape; unknown records get an id-only fallback.
        def serialize(type, record)
          return nil unless record.respond_to?(:id) && record.id

          if record.respond_to?(:as_json_for_search)
            record.as_json_for_search
          else
            { id: record.id, type: type.to_s }
          end
        end

        def satisfies_condition?(record)
          return true unless record.respond_to?(:satisfies_search_condition?, true)

          record.send(:satisfies_search_condition?)
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
