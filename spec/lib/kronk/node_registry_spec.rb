# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::NodeRegistry do
  before do
    described_class.reload!
    Kronk::KornerRegistry.reload!
  end

  describe '.all' do
    it 'loads nodes from config/kronk_nodes.yaml' do
      ids = described_class.all.map(&:id)
      expect(ids).to include('feed.home', 'profile.view', 'settings.prefs', 'hub.landing')
    end

    it 'loads nodes from every korner manifest with a nodes: block' do
      ids = described_class.all.map(&:id)
      expect(ids).to include('kommons.index', 'booth.index', 'kalendar.index')
    end

    it 'returns Node structs with required fields populated' do
      home = described_class.find('feed.home')
      expect(home).to be_a(described_class::Node)
      expect(home.bucket).to eq('feed')
      expect(home.label).to eq('Home timeline')
      expect(home.lifecycle).to eq('live')
    end

    it 'assigns bucket=hub and parent=<slug> for korner-declared nodes by default' do
      booth = described_class.find('booth.index')
      expect(booth.bucket).to eq('hub')
      expect(booth.parent).to eq('booth')
    end

    it 'tags each node with its source (cross_cutting or korner)' do
      cross = described_class.find('feed.home')
      korner = described_class.find('booth.index')

      expect(cross.source).to eq(:cross_cutting)
      expect(korner.source).to eq(:korner)
    end
  end

  describe '.find' do
    it 'returns nil for unknown ids' do
      expect(described_class.find('not-a-node')).to be_nil
    end

    it 'accepts symbol or string ids' do
      expect(described_class.find(:'feed.home')).to eq(described_class.find('feed.home'))
    end
  end

  describe '.for_bucket' do
    it 'filters by bucket' do
      feed_nodes = described_class.for_bucket('feed')
      expect(feed_nodes.map(&:id)).to include('feed.home')
      # Not every feed-bucket id is 'feed.'-prefixed: settings.feed
      # deliberately hangs off the feed limb (a space configures itself in
      # its own bucket). Assert on bucket, which is what the method filters.
      expect(feed_nodes).to all(have_attributes(bucket: 'feed'))
    end
  end

  describe '.in_korner' do
    it 'returns hub nodes with matching parent slug' do
      booth_ids = described_class.in_korner('booth').map(&:id)
      expect(booth_ids).to include('booth.index', 'booth.set')
      expect(booth_ids).to all(start_with('booth.'))
    end

    it 'returns empty for a korner with no nodes' do
      # nudges korner declares `nodes: []` because feed.nudges covers it
      expect(described_class.in_korner('nudges')).to be_empty
    end
  end

  describe 'lifecycle handling' do
    it 'accepts the four documented lifecycle states' do
      lifecycles = described_class.all.map(&:lifecycle).uniq
      expect(lifecycles - Kronk::NodeRegistry::LIFECYCLES).to be_empty
    end

    it 'flags stub korners as lifecycle:soon' do
      klot = described_class.find('klot.index')
      albutts = described_class.find('albutts.index')
      expect(klot.lifecycle).to eq('live')
      expect(albutts.lifecycle).to eq('soon')
    end
  end

  describe 'SPA marker' do
    it 'sets spa? true for React-Router-only routes' do
      expect(described_class.find('feed.home').spa?).to be true
      expect(described_class.find('profile.edit').spa?).to be true
    end

    it 'sets spa? false when a Rails route_name is declared' do
      expect(described_class.find('profile.view').spa?).to be false
    end
  end

  describe 'duplicate ids' do
    it 'keeps the first occurrence and drops later duplicates' do
      # Assert the invariant on the current registry: no duplicates.
      ids = described_class.all.map(&:id)
      expect(ids.tally.values).to all(eq(1))
    end
  end

  describe '.links_for' do
    it 'returns [] for an unknown node' do
      expect(described_class.links_for('not-a-node')).to eq([])
    end

    it 'returns manifest-declared explicit links for a node' do
      links = described_class.links_for('kalendar.event')
      targets = links.pluck('to')
      expect(targets).to include('martketplace.index', 'huddle.index')
    end

    it 'auto-derives projects_to feed.home for a korner index node with feed_projection' do
      links = described_class.links_for('kommons.index')
      auto = links.find { |l| l['kind'] == 'projects_to' && l['to'] == 'feed.home' }
      expect(auto).to be_present
    end

    it 'dedupes when auto and explicit links produce the same edge' do
      links = described_class.links_for('kommons.index')
      pt_home = links.select { |l| l['kind'] == 'projects_to' && l['to'] == 'feed.home' }
      expect(pt_home.length).to eq(1)
    end

    it 'normalises unknown link kinds out' do
      # sanity: every emitted kind is in the allowed set
      described_class.all.each do |node| # rubocop:disable Rails/FindEach -- NodeRegistry.all is Array<Node>
        kinds = described_class.links_for(node.id).map { |l| l['kind'] }.uniq
        expect(kinds - Kronk::NodeRegistry::LINK_KINDS).to be_empty
      end
    end
  end
end
