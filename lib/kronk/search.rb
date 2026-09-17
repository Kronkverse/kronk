# frozen_string_literal: true

# Kronk::Search — search subsystem entry point.
#
# One adapter powers writes (index / remove on model callbacks) and
# reads (search + policy-filter on the controller). The specific
# adapter is chosen at boot via the `SEARCH_BACKEND` env var; the
# default is `Null` so dev/test environments stay green without a
# Meilisearch container running.
#
#   Kronk::Search.adapter.index(:statuses, status)
#   Kronk::Search.adapter.remove(:statuses, status)
#   Kronk::Search.adapter.search(type: :statuses, query: 'coffee', viewer: current_account)
#
# See:
#   - /home/shared/rebuild/memory/project_kronk_rebuild_search_spec_draft.md (spec)
#   - ~/.claude/plans/kronk-search-implementation-plan.md (this PR = PR 1)

require_relative 'search/index_configs'
require_relative 'search/adapter'
require_relative 'search/adapter/null'
require_relative 'search/adapter/meilisearch'
require_relative 'search/policy_filter'

module Kronk
  module Search
    module_function

    # Cached adapter instance. Reset with `reset_adapter!` (specs).
    def adapter
      @adapter ||= build_adapter
    end

    def reset_adapter!
      @adapter = nil
    end

    def backend
      ENV.fetch('SEARCH_BACKEND', 'null')
    end

    def build_adapter
      case backend
      when 'meilisearch'
        Adapter::Meilisearch.new
      else
        Adapter::Null.new
      end
    end
  end
end
