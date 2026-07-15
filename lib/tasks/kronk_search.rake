# frozen_string_literal: true

# Kronk Search rake tasks.
#
#   bin/rake kronk:search:configure           # push index settings only
#   bin/rake kronk:search:reindex             # settings + full backfill (all 9 indexes)
#   bin/rake kronk:search:reindex[statuses]   # single index
#
# Uses the currently-configured adapter (`SEARCH_BACKEND`); against
# the Null adapter these are no-ops and safe to run in any env.

MODEL_FOR_SEARCH_TYPE = {
  statuses: 'Status',
  accounts: 'Account',
  kalendar_events: 'Event',
  kommons_proposals: 'Proposal',
  booth_sets: 'BoothSet',
  marketplace_listings: 'Listing',
  groups: 'Group',
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
  end
end
