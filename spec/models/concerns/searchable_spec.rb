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

      # `searchable_as` registers `after_commit` callbacks, which are an
      # ActiveRecord API. This double is deliberately not AR-backed (the
      # concern's contract under test is the adapter, and we invoke the public
      # sync/remove methods directly), so stub the callback registration as a
      # no-op to let `searchable_as` run.
      #
      # Stubbing it out is also why this file could not catch the create hook
      # going missing — see the AR-backed group at the bottom, which does.
      def self.after_commit(*, **); end

      attr_accessor :id

      include ActiveModel::Model
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

        # See test_class above: `searchable_as` registers an `after_commit`
        # callback (an ActiveRecord API). This double isn't AR-backed, so
        # stub the registration as a no-op to let `searchable_as` run.
        def self.after_commit(*, **); end

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

  # These exercise the real ActiveRecord callback registration, which the
  # anonymous class above deliberately stubs out.
  #
  # The registration is one `after_commit ..., on: [:create, :update]` rather
  # than an `after_create_commit` plus an `after_update_commit`. Those two are
  # both sugar for `after_commit ..., on:`, and registering the same method
  # name twice replaces rather than appends — so the obvious spelling kept only
  # the update hook, and records were indexed when edited and never when
  # created.
  describe 'callback registration on a real model' do
    it 'indexes on create' do
      expect(adapter).to receive(:index).with(:kategories, anything)
      Tag.create!(name: 'searchablecreatecurated', curated: true)
    end

    it 'indexes on update' do
      tag = Tag.create!(name: 'searchableupdatecurated', curated: true)
      expect(adapter).to receive(:index).with(:kategories, tag)
      tag.update!(reviewed_at: Time.now.utc)
    end

    it 'removes on destroy' do
      tag = Tag.create!(name: 'searchabledestroycurated', curated: true)
      expect(adapter).to receive(:remove).with(:kategories, tag)
      tag.destroy
    end

    it 'honours the `if:` condition on create' do
      expect(adapter).to_not receive(:index)
      Tag.create!(name: 'searchablecreateuncurated', curated: false)
    end
  end
end
