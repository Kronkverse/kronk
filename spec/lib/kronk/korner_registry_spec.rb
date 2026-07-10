# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::KornerRegistry do
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

    it 'exposes identity fields' do
      kommons = described_class.find('kommons')
      expect(kommons.name).to eq('Kommons')
      expect(kommons.icon).to eq('gavel')
      expect(kommons.render_target).to eq('native')
      expect(kommons.version).to be_a(String)
    end

    it 'exposes storage.db_namespace via convenience reader' do
      kommons = described_class.find('kommons')
      expect(kommons.db_namespace).to eq('proposal_')
    end

    it 'exposes feed_projection.status_association via convenience reader' do
      kommons = described_class.find('kommons')
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
        expect(slugs).to_not include(slug)
      end
    end
  end

  describe '.find' do
    it 'returns the manifest for a known slug' do
      expect(described_class.find('kommons').slug).to eq('kommons')
    end

    it 'returns nil for an unknown slug' do
      expect(described_class.find('does-not-exist')).to be_nil
    end
  end

  describe 'security block synthesis (1.7.0 shape)' do
    # 1.7.0 manifests place security fields at top-level. Parser synthesises
    # a `security:` block so downstream code sees a uniform shape.
    it 'exposes maintainers derived from top-level steward_role' do
      kommons = described_class.find('kommons')
      expect(kommons.maintainers).to include('moderator')
    end

    it 'exposes federates? derived from top-level federates' do
      kommons = described_class.find('kommons')
      expect(kommons.federates?).to be false
    end
  end

  describe '.reserved_slugs' do
    it 'loads the reserved slug list from config/korners/reserved_slugs.yaml' do
      slugs = described_class.reserved_slugs
      expect(slugs).to include('hub', 'kronk', 'nudges', 'admin', 'settings', 'api')
    end

    it 'does not include reserved_slugs.yaml as a manifest' do
      slugs = described_class.all.map(&:slug)
      expect(slugs).to_not include('reserved_slugs')
    end

    it 'does not collide with any shipping manifest slug' do
      manifest_slugs = described_class.all.map(&:slug)
      overlap = manifest_slugs & described_class.reserved_slugs
      expect(overlap).to be_empty, "manifests collide with reserved slugs: #{overlap}"
    end
  end

  describe 'deprecated ::Korners alias' do
    it 'resolves to Kronk::KornerRegistry' do
      expect(Korners).to equal(described_class)
    end

    it 'exposes Manifest struct via the alias' do
      expect(Korners::Manifest).to equal(described_class::Manifest)
    end
  end
end
