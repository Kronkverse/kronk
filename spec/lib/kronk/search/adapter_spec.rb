# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::Search do
  before { described_class.reset_adapter! }
  after  { described_class.reset_adapter! }

  describe '.adapter' do
    context 'when SEARCH_BACKEND is unset' do
      before { ENV.delete('SEARCH_BACKEND') }

      it 'returns the Null adapter' do
        expect(described_class.adapter).to be_a(Kronk::Search::Adapter::Null)
      end
    end

    context 'when SEARCH_BACKEND=null' do
      around { |example| ClimateControl.modify(SEARCH_BACKEND: 'null') { example.run } }

      it 'returns the Null adapter' do
        expect(described_class.adapter).to be_a(Kronk::Search::Adapter::Null)
      end
    end

    context 'when SEARCH_BACKEND=meilisearch' do
      around do |example|
        ClimateControl.modify(SEARCH_BACKEND: 'meilisearch') { example.run }
      end

      it 'returns the Meilisearch adapter' do
        expect(described_class.adapter).to be_a(Kronk::Search::Adapter::Meilisearch)
      end
    end

    it 'caches the adapter instance across calls' do
      first = described_class.adapter
      second = described_class.adapter
      expect(first).to equal(second)
    end
  end
end

RSpec.describe Kronk::Search::Adapter::Null do
  let(:adapter) { described_class.new }
  let(:record)  { double('record', id: 42) } # rubocop:disable RSpec/VerifiedDoubles -- Object has no #id, so a verifying double can't stand in for an indexable record

  describe '#index' do
    it 'does not raise' do
      expect { adapter.index(:statuses, record) }.to_not raise_error
    end
  end

  describe '#remove' do
    it 'does not raise' do
      expect { adapter.remove(:statuses, record) }.to_not raise_error
    end
  end

  describe '#search' do
    it 'returns an empty array' do
      expect(adapter.search(type: :statuses, query: 'anything')).to eq([])
    end

    it 'accepts filters and viewer without failing' do
      expect(adapter.search(type: :statuses, query: 'q', filters: { author_id: 1 }, viewer: nil)).to eq([])
    end
  end

  describe '#reindex_all' do
    it 'does not raise' do
      expect { adapter.reindex_all(:statuses) }.to_not raise_error
    end
  end

  describe '#clear' do
    it 'does not raise and reports success' do
      expect(adapter.clear(:statuses)).to be(true)
    end
  end
end

RSpec.describe Kronk::Search::Adapter::Meilisearch do
  # The Meilisearch adapter is exercised end-to-end on shadow after
  # PR 0 lands the container. Unit tests here cover the behaviour
  # that must hold regardless of a live server: error swallowing,
  # graceful degradation, and the shape of the search-result hash.

  let(:record) { double('record', id: 42) } # rubocop:disable RSpec/VerifiedDoubles -- Object has no #id, so a verifying double can't stand in for an indexable record

  it 'swallows write-path errors and logs them' do
    fake_client = instance_double(MeiliSearch::Client)
    allow(fake_client).to receive(:index).and_raise(StandardError, 'meili unreachable')
    adapter = described_class.new(client: fake_client)

    expect(Rails.logger).to receive(:error).with(/index.*failed.*meili unreachable/)
    expect { adapter.index(:statuses, record) }.to_not raise_error
  end

  it 'swallows read-path errors and returns an empty array' do
    fake_client = instance_double(MeiliSearch::Client)
    allow(fake_client).to receive(:index).and_raise(StandardError, 'meili unreachable')
    adapter = described_class.new(client: fake_client)

    allow(Rails.logger).to receive(:warn)
    expect(adapter.search(type: :statuses, query: 'anything')).to eq([])
  end

  describe 'index naming' do
    let(:fake_client) { instance_double(MeiliSearch::Client) }
    let(:adapter)     { described_class.new(client: fake_client) }

    it 'uses the kronk_ prefix when MEILISEARCH_INDEX_PREFIX is unset' do
      expect(fake_client).to receive(:index).with('kronk_statuses')
      adapter.send(:index_for, :statuses)
    end

    it 'uses MEILISEARCH_INDEX_PREFIX when set' do
      # Two environments sharing one Meilisearch server must not share
      # indexes: on the Kronk droplet shadow runs on a clone of
      # production, so the ids collide exactly and a delete on one
      # would remove the other's document.
      ClimateControl.modify MEILISEARCH_INDEX_PREFIX: 'kronk_shadow_' do
        expect(fake_client).to receive(:index).with('kronk_shadow_statuses')
        adapter.send(:index_for, :statuses)
      end
    end
  end

  describe '#clear' do
    let(:fake_client) { instance_double(MeiliSearch::Client) }

    it 'empties the index and reports success' do
      fake_index = double('index') # rubocop:disable RSpec/VerifiedDoubles -- Meilisearch::Index is not loaded in unit specs
      allow(fake_client).to receive(:index).and_return(fake_index)
      expect(fake_index).to receive(:delete_all_documents)

      expect(described_class.new(client: fake_client).clear(:statuses)).to be(true)
    end

    it 'swallows errors and reports failure rather than raising' do
      allow(fake_client).to receive(:index).and_raise(StandardError, 'meili unreachable')
      allow(Rails.logger).to receive(:warn)

      expect(described_class.new(client: fake_client).clear(:statuses)).to be(false)
    end
  end
end
