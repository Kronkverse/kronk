# frozen_string_literal: true

# Kronk::Search::IndexConfigs — per-index Meilisearch settings.
#
# Applied once per index by the reindex rake task; Meilisearch stores
# the settings server-side so subsequent writes don't need to repeat
# them. Attribute categories:
#
#   searchable_attributes — fields the query hits (order = relevance
#     priority; earlier fields weighted higher)
#   filterable_attributes — fields usable in a `filter=` param
#     (author_id, category, discoverable, curated, etc.)
#   sortable_attributes   — fields usable in a `sort=` param
#     (created_at for recency ranking)
#
# Adding a field to `filterable_attributes` after the index has data
# requires a re-settings call; Meilisearch handles that in place.

module Kronk
  module Search
    module IndexConfigs
      CONFIGS = {
        statuses: {
          searchable_attributes: %w(text spoiler_text),
          filterable_attributes: %w(account_id visibility created_at kategory_names group_ids),
          sortable_attributes: %w(created_at),
        },
        accounts: {
          searchable_attributes: %w(username display_name note acct),
          filterable_attributes: %w(locked discoverable local created_at),
          sortable_attributes: %w(created_at),
        },
        kalendar_events: {
          searchable_attributes: %w(title description location_name host_acct),
          filterable_attributes: %w(account_id starts_at ends_at),
          sortable_attributes: %w(starts_at created_at),
        },
        kommons_proposals: {
          searchable_attributes: %w(title body summary),
          filterable_attributes: %w(created_by_account_id status categories),
          sortable_attributes: %w(created_at),
        },
        booth_sets: {
          searchable_attributes: %w(title artist_name genre event_name),
          filterable_attributes: %w(account_id published created_at),
          sortable_attributes: %w(created_at play_count),
        },
        wachuneed_listings: {
          searchable_attributes: %w(title description category subcategory),
          filterable_attributes: %w(account_id category state price_currency),
          sortable_attributes: %w(created_at price_cents),
        },
        groups: {
          searchable_attributes: %w(name description),
          filterable_attributes: %w(discoverable archived),
          sortable_attributes: %w(created_at),
        },
        kategories: {
          searchable_attributes: %w(name),
          filterable_attributes: %w(curated),
          sortable_attributes: %w(created_at),
        },
        nudge_messages: {
          searchable_attributes: %w(body),
          filterable_attributes: %w(account_id nudge_id created_at),
          sortable_attributes: %w(created_at),
        },
      }.freeze

      module_function

      def for(type)
        CONFIGS.fetch(type.to_sym, {})
      end

      def types
        CONFIGS.keys
      end
    end
  end
end
