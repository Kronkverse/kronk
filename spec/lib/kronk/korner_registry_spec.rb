# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::KornerRegistry do
  let(:enforced_slugs) do
    %w(albutts booth feed hub huddle inflow kalendar klot kommons kommunity krew kuestions map martketplace moments nudges profile settings welcome)
  end
  let(:non_enforced_slugs) { %w(you) }

  before { described_class.reload! }

  describe '.all' do
    it 'loads every manifest under config/korners/' do
      slugs = described_class.all.map(&:slug)
      (enforced_slugs + non_enforced_slugs).each do |slug|
        expect(slugs).to include(slug), "manifest for #{slug} was not loaded"
      end
    end

    it 'exposes identity fields' do
      kommons = described_class.find('kommons')
      expect(kommons.name).to eq('Kommons')
      expect(kommons.icon).to eq('material' => 'construction')
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
    it 'returns only the enforced manifests' do
      slugs = described_class.enforced.map(&:slug)
      expect(slugs).to match_array(enforced_slugs)
    end

    it 'excludes non-enforced manifests' do
      slugs = described_class.enforced.map(&:slug)
      non_enforced_slugs.each do |slug|
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
      expect(slugs).to include('hub', 'kronk', 'admin', 'settings', 'api')
    end

    it 'does not include reserved_slugs.yaml as a manifest' do
      slugs = described_class.all.map(&:slug)
      expect(slugs).to_not include('reserved_slugs')
    end

    # Core spaces are exempt. The reservation stops a *korner* claiming a
    # platform route; a core space claiming its own platform route is the
    # reservation working. Without the exemption `feed` and `hub` could never
    # have manifests, and the workaround in use was to un-reserve the slug
    # instead — which gives the protection away entirely.
    it 'does not collide with any shipping korner slug' do
      korner_slugs = described_class.all.reject(&:core?).map(&:slug)
      overlap = korner_slugs & described_class.reserved_slugs
      expect(overlap).to be_empty, "korners collide with reserved slugs: #{overlap}"
    end
  end

  describe 'core spaces' do
    let(:korner) { described_class::Manifest.new(slug: 'booth') }
    let(:core) { described_class::Manifest.new(slug: 'feed', core: true, mount: '/home') }

    it 'defaults a korner to /hub/<slug>' do
      expect(korner.mount_path).to eq('/hub/booth')
      expect(korner.core?).to be(false)
    end

    it 'lets a core space declare its own mount' do
      expect(core.mount_path).to eq('/home')
      expect(core.core?).to be(true)
    end

    it 'treats a blank mount as absent' do
      # `mount: ""` in YAML should fall back to the korner default rather than
      # producing an empty path that matches everything.
      expect(described_class::Manifest.new(slug: 'booth', mount: '').mount_path).to eq('/hub/booth')
    end

    it 'is not core unless the flag is exactly true' do
      expect(described_class::Manifest.new(slug: 'x', core: 'yes').core?).to be(false)
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
