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
end
