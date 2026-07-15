# frozen_string_literal: true

# Kronk::Search::Adapter::Null — no-op search adapter.
#
# The default when `SEARCH_BACKEND` isn't set to `meilisearch`. Every
# write is dropped, every read returns an empty result set. Keeps
# dev/test/CI environments green without a Meilisearch container.
#
# The controller layer treats an empty result set the same as "no
# match" — the surface degrades gracefully rather than 500ing.

module Kronk
  module Search
    class Adapter
      class Null < Adapter
        def index(type, record)
          # no-op — record ID preserved for optional debug logging
          Rails.logger.debug { "[kronk:search:null] index(#{type}, #{record&.id})" }
        end

        def remove(type, record)
          Rails.logger.debug { "[kronk:search:null] remove(#{type}, #{record&.id})" }
        end

        def search(type:, query:, filters: {}, viewer: nil) # rubocop:disable Lint/UnusedMethodArgument
          Rails.logger.debug { "[kronk:search:null] search(type=#{type}, query=#{query.inspect})" }
          []
        end

        def reindex_all(type)
          Rails.logger.info("[kronk:search:null] reindex_all(#{type}) — no-op adapter, nothing indexed")
        end
      end
    end
  end
end
