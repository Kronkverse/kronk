# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::Search::PolicyFilter do
  let(:viewer) { Fabricate(:account) }

  describe '.filter' do
    it 'returns an empty Search when hits are empty' do
      result = described_class.filter([], viewer)
      expect(result.accounts).to be_empty
      expect(result.statuses).to be_empty
      expect(result.hashtags).to be_empty
    end

    it 'groups adapter hits by type into the Search presenter' do
      account = Fabricate(:account)
      status  = Fabricate(:status, account: account, visibility: :public)
      tag     = Fabricate(:tag, name: 'searchtest', curated: true)

      hits = [
        { type: :accounts,   id: account.id },
        { type: :statuses,   id: status.id },
        { type: :kategories, id: tag.id },
      ]

      result = described_class.filter(hits, viewer)

      expect(result.accounts).to contain_exactly(account)
      expect(result.statuses).to contain_exactly(status)
      expect(result.hashtags).to contain_exactly(tag)
    end

    it 'gates statuses through StatusPolicy — private posts hidden from strangers' do
      author = Fabricate(:account)
      private_status = Fabricate(:status, account: author, visibility: :private)

      hits = [{ type: :statuses, id: private_status.id }]

      result = described_class.filter(hits, viewer)

      expect(result.statuses).to be_empty
    end

    it 'excludes tags that are not curated' do
      uncurated_tag = Fabricate(:tag, name: 'notcurated', curated: false)
      hits = [{ type: :kategories, id: uncurated_tag.id }]

      result = described_class.filter(hits, viewer)

      expect(result.hashtags).to be_empty
    end
  end
end
