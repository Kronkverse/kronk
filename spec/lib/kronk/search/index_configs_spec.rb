# frozen_string_literal: true

require 'rails_helper'

# Every searchable model has to be able to build its document. BoothSet could
# not — it asked for `genre` when the column is `genres` — and because the
# indexer catches and logs rather than raising, the whole type silently failed
# to index. Nobody noticed until a real reindex was run against real data and a
# DJ set could not be found by name (2026-09-14).
#
# The models are read off the same place the rake task reads them, so a new
# searchable model is covered here the moment it is added to that map.
RSpec.describe Kronk::Search::IndexConfigs do
  # Mirrors MODEL_FOR_SEARCH_TYPE in lib/tasks/kronk_search.rake.
  searchable = {
    statuses: 'Status',
    accounts: 'Account',
    kalendar_events: 'Event',
    kommons_proposals: 'Proposal',
    booth_sets: 'BoothSet',
    wachuneed_listings: 'Listing',
    krews: 'Krew',
    kategories: 'Tag',
    nudge_messages: 'NudgeMessage',
  }

  searchable.each do |type, model_name|
    context "with #{model_name} (#{type})" do
      let(:model) { model_name.constantize }

      it 'declares the type the indexer expects' do
        expect(model.search_index_type).to eq(type)
      end

      # A bare instance rather than a fabricated one: the failure being
      # guarded against is a document asking for a method that does not exist,
      # which does not need a saved row to show up — and four of these models
      # have no fabricator.
      it 'builds a document without raising' do
        expect { model.new.as_json_for_search }.to_not raise_error
      end

      it 'puts every searchable attribute in the document' do
        doc    = model.new.as_json_for_search
        config = described_class.for(type)
        next if config.blank?

        missing = Array(config[:searchable_attributes]).map(&:to_sym) - doc.keys.map(&:to_sym)
        expect(missing).to be_empty,
                           "#{model_name} is indexed on #{missing.join(', ')}, which its document does not contain — " \
                           'searching those fields would silently match nothing'
      end
    end
  end
end
