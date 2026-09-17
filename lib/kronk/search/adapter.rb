# frozen_string_literal: true

# Kronk::Search::Adapter — abstract base class for search backends.
#
# Two shipping adapters:
#   - Kronk::Search::Adapter::Meilisearch — hits the live Meilisearch
#     service.
#   - Kronk::Search::Adapter::Null — no-op; the default when no backend
#     is configured. Keeps dev + test green without Meilisearch running.
#
# Callers use `Kronk::Search.adapter` and never instantiate directly.

module Kronk
  module Search
    class Adapter
      # Write path: called from `Searchable` model callbacks after
      # commit. `type` is a symbol (`:statuses`, `:accounts`, etc.);
      # `record` is the ActiveRecord object (adapter serialises).
      def index(type, record)
        raise NotImplementedError
      end

      # Called after destroy (or when an account opts out — future).
      def remove(type, record)
        raise NotImplementedError
      end

      # Read path: hit by the API controller. Returns an array of
      # `{ type:, id:, score:, source: }` hits; callers policy-filter
      # by loading records from AR and gating with `Policy.new(...).show?`.
      #
      # `type` — single index or `:all` for the multi-index universal search.
      # `query` — user-supplied text; the adapter is responsible for
      #   passing this to the engine safely (no code injection).
      # `filters` — hash of shape { author_id:, date_range:, kategory: ... }.
      # `viewer` — the requesting Account (may be nil for anonymous callers).
      def search(type:, query:, filters: {}, viewer: nil)
        raise NotImplementedError
      end

      # Bulk reindex — called by the rake task once at deploy time (and
      # any time the schema of an index changes). Walks `model` in
      # batches and writes documents to the adapter's backing store.
      #
      # Additive: it writes a document for every record it walks and
      # never removes one. A document whose record has since been
      # deleted therefore survives any number of reindexes — use
      # `clear` first when the index may hold documents that no longer
      # correspond to rows (see `kronk:search:rebuild`).
      def reindex_all(type, model)
        raise NotImplementedError
      end

      # Drop every document in one index, leaving its settings intact.
      # The only way to remove a document the write path never saw —
      # e.g. rows deleted while the backend was unreachable, or an
      # index populated by a different environment.
      def clear(type)
        raise NotImplementedError
      end
    end
  end
end
