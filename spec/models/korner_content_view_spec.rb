# frozen_string_literal: true

require 'rails_helper'

RSpec.describe KornerContentView do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'requires a korner_slug' do
      row = described_class.new(account: account, korner_slug: nil, content_id: 1)
      expect(row).to_not be_valid
    end

    it 'requires a content_id' do
      row = described_class.new(account: account, korner_slug: 'moments', content_id: nil)
      expect(row).to_not be_valid
    end

    it 'enforces uniqueness of (account, korner_slug, content_id)' do
      described_class.create!(account: account, korner_slug: 'moments', content_id: 42)
      dup = described_class.new(account: account, korner_slug: 'moments', content_id: 42)
      expect(dup).to_not be_valid
    end

    it 'allows the same content_id under a different korner_slug' do
      described_class.create!(account: account, korner_slug: 'moments', content_id: 42)
      other = described_class.new(account: account, korner_slug: 'kommons', content_id: 42)
      expect(other).to be_valid
    end
  end
end
