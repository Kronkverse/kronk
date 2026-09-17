# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::Kategories do
  before { described_class.reload! }

  describe '.defaults' do
    it 'loads the list from config/kategory_defaults.yaml' do
      names = described_class.defaults
      expect(names).to include('music', 'essays', 'news', 'code')
    end

    it 'deduplicates entries' do
      expect(described_class.defaults).to eq(described_class.defaults.uniq)
    end
  end

  describe '.seed!' do
    it 'creates a curated Tag for every default' do
      described_class.seed!
      described_class.defaults.each do |name|
        tag = Tag.find_by(name: name)
        expect(tag).to be_present
        expect(tag.curated?).to be true
      end
    end

    it 'is idempotent — running twice does not duplicate' do
      described_class.seed!
      expect { described_class.seed! }.to_not change(Tag, :count)
    end

    it 'promotes an existing uncurated tag to curated' do
      Tag.find_or_create_by!(name: 'music') { |t| t.curated = false }

      described_class.seed!

      expect(Tag.find_by(name: 'music').curated?).to be true
    end
  end
end
