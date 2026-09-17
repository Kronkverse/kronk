# frozen_string_literal: true

# Kronk Search rake tasks.
#
#   bin/rake kronk:search:configure           # push index settings only
#   bin/rake kronk:search:reindex             # settings + full backfill (all 9 indexes)
#   bin/rake kronk:search:reindex[statuses]   # single index
#   bin/rake kronk:search:rebuild             # empty each index first, then backfill
#   bin/rake kronk:search:rebuild[statuses]   # single index
#
# `reindex` is additive — it writes a document per record it walks and
# never removes one, so a document whose row is gone survives it. Reach
# for `rebuild` when the index may hold documents that no longer match
# rows: after pointing an environment at a namespace another
# environment has been writing to, or when rows were deleted while
# Meilisearch was unreachable.
#
# Uses the currently-configured adapter (`SEARCH_BACKEND`); against
# the Null adapter these are no-ops and safe to run in any env.

MODEL_FOR_SEARCH_TYPE = {
  statuses: 'Status',
  accounts: 'Account',
  kalendar_events: 'Event',
  kommons_proposals: 'Proposal',
  booth_sets: 'BoothSet',
  wachuneed_listings: 'Listing',
  krews: 'Krew',
  kategories: 'Tag',
  nudge_messages: 'NudgeMessage',
}.freeze

namespace :kronk do
  namespace :search do
    desc 'Push index settings to Meilisearch (no data write)'
    task configure: :environment do
      adapter = Kronk::Search.adapter
      unless adapter.is_a?(Kronk::Search::Adapter::Meilisearch)
        puts "SEARCH_BACKEND is not meilisearch (currently: #{Kronk::Search.backend}); nothing to configure."
        next
      end

      Kronk::Search::IndexConfigs.types.each do |type|
        puts "Configuring #{type}…"
        adapter.configure_index(type)
      end
      puts 'Done.'
    end

    desc 'Reindex Kronk records into the search backend'
    task :reindex, [:type] => :environment do |_, args|
      target = args[:type]&.to_sym
      types  = target ? [target] : MODEL_FOR_SEARCH_TYPE.keys

      types.each do |type|
        model_name = MODEL_FOR_SEARCH_TYPE[type]
        unless model_name
          puts "Unknown type: #{type}. Known: #{MODEL_FOR_SEARCH_TYPE.keys.join(', ')}"
          next
        end

        model = model_name.constantize
        unless model.include?(Searchable)
          puts "#{model_name} does not include Searchable; skipping."
          next
        end

        Kronk::Search.adapter.reindex_all(type, model)
      end
    end

    desc 'Empty each index, then reindex — use when stale documents may be present'
    task :rebuild, [:type] => :environment do |_, args|
      target = args[:type]&.to_sym
      types  = target ? [target] : MODEL_FOR_SEARCH_TYPE.keys

      types.each do |type|
        model_name = MODEL_FOR_SEARCH_TYPE[type]
        unless model_name
          puts "Unknown type: #{type}. Known: #{MODEL_FOR_SEARCH_TYPE.keys.join(', ')}"
          next
        end

        model = model_name.constantize
        unless model.include?(Searchable)
          puts "#{model_name} does not include Searchable; skipping."
          next
        end

        puts "Emptying #{type}…"
        Kronk::Search.adapter.clear(type)
        Kronk::Search.adapter.reindex_all(type, model)
      end
    end
  end
end
