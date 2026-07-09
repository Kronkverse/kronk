# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Korners do
  let(:main_branch_slugs) { %w(kommons kuestions kalendar booth in_flow nudges) }
  let(:dev_branch_slugs)  { %w(marketplace tree klot) }

  before { described_class.reload! }

  describe '.all' do
    it 'loads every manifest under config/korners/' do
      slugs = described_class.all.map(&:slug)
      (main_branch_slugs + dev_branch_slugs).each do |slug|
        expect(slugs).to include(slug), "manifest for #{slug} was not loaded"
      end
    end

    it 'exposes planet from each manifest' do
      kommons = described_class.all.find { |m| m.slug == 'kommons' }
      expect(kommons.planet).to eq('jupiter')
    end

    it 'exposes the feed_projection.status_association for Kommons' do
      kommons = described_class.all.find { |m| m.slug == 'kommons' }
      expect(kommons.status_association).to eq(:proposal)
    end
  end

  describe '.enforced' do
    it 'returns only the main-branch manifests' do
      slugs = described_class.enforced.map(&:slug)
      expect(slugs).to match_array(main_branch_slugs)
    end

    it 'excludes dev-branch manifests' do
      slugs = described_class.enforced.map(&:slug)
      dev_branch_slugs.each do |slug|
        expect(slugs).not_to include(slug)
      end
    end
  end
end
