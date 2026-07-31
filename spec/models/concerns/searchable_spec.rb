# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Searchable do
  let(:adapter) { instance_double(Kronk::Search::Adapter::Null, index: nil, remove: nil) }
  # Anonymous test class — an in-memory AR-backed shape isn't needed;
  # the concern's contract is against the adapter, not the DB.
  let(:test_class) do
    Class.new do
      def self.name
        'FakeIndexed'
      end

      attr_accessor :id

      include ActiveModel::Model
      # ActiveSupport::Concern's callback DSL relies on ActiveSupport::Callbacks;
      # `after_*_commit` is an AR API. For unit coverage we call the public
      # sync/remove methods directly, which is what the callbacks would.
      include Searchable

      searchable_as :fake

      def initialize(id, *)
        @id = id
      end
    end
  end

  before do
    allow(Kronk::Search).to receive(:adapter).and_return(adapter)
  end

  it 'declares the search index type via class attribute' do
    expect(test_class.search_index_type).to eq(:fake)
  end

  it 'defaults to id-only document via #as_json_for_search' do
    record = test_class.new(42)
    expect(record.as_json_for_search).to eq({ id: 42 })
  end

  describe '#sync_to_search_index' do
    it 'calls Kronk::Search.adapter.index with the type + record' do
      record = test_class.new(42)
      expect(adapter).to receive(:index).with(:fake, record)
      record.sync_to_search_index
    end
  end

  describe '#remove_from_search_index' do
    it 'calls Kronk::Search.adapter.remove with the type + record' do
      record = test_class.new(42)
      expect(adapter).to receive(:remove).with(:fake, record)
      record.remove_from_search_index
    end
  end

  describe 'conditional indexing via `if:`' do
    let(:conditional_class) do
      Class.new do
        def self.name = 'FakeConditional'

        attr_accessor :id, :flag

        include ActiveModel::Model
        include Searchable

        searchable_as :fake_conditional, if: :flag_on?

        def initialize(id:, flag:)
          @id = id
          @flag = flag
        end

        def flag_on?
          flag == true
        end
      end
    end

    it 'writes to the adapter when the condition holds' do
      record = conditional_class.new(id: 1, flag: true)
      expect(adapter).to receive(:index).with(:fake_conditional, record)
      record.sync_to_search_index
    end

    it 'skips the write when the condition fails' do
      record = conditional_class.new(id: 2, flag: false)
      expect(adapter).to_not receive(:index)
      record.sync_to_search_index
    end
  end
end
