# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::KornerSeen do
  let(:viewer) { Fabricate(:account) }
  let(:poster) { Fabricate(:account) }
  let(:slug)   { 'kommons' }

  before { viewer.follow!(poster) }

  def korner_status(account: poster, visibility: :public)
    Fabricate(:status, account: account, source_korner: slug, visibility: visibility)
  end

  describe '.mark_seen' do
    it 'records a per-item seen row' do
      status = korner_status
      expect { described_class.mark_seen(viewer, slug, status.id) }
        .to change { KornerContentView.where(account: viewer, korner_slug: slug, content_id: status.id).count }
        .from(0).to(1)
    end

    it 'is idempotent (double-mark leaves one row)' do
      status = korner_status
      described_class.mark_seen(viewer, slug, status.id)
      described_class.mark_seen(viewer, slug, status.id)
      expect(KornerContentView.where(account: viewer, korner_slug: slug, content_id: status.id).count).to eq(1)
    end

    it 'no-ops for an item already below the baseline' do
      described_class.mark_all_seen(viewer, slug) # baseline advances past current max
      status = korner_status
      # Force the item under the baseline by advancing again.
      described_class.mark_all_seen(viewer, slug)
      expect { described_class.mark_seen(viewer, slug, status.id) }
        .to_not change(KornerContentView, :count)
    end

    it 'no-ops on a nil account or blank slug' do
      expect { described_class.mark_seen(nil, slug, 1) }.to_not change(KornerContentView, :count)
      expect { described_class.mark_seen(viewer, '', 1) }.to_not change(KornerContentView, :count)
    end
  end

  describe '.mark_all_seen' do
    it 'advances the baseline to the korner newest id and prunes covered rows' do
      old = korner_status
      described_class.mark_seen(viewer, slug, old.id)
      newest = korner_status

      described_class.mark_all_seen(viewer, slug)

      marker = KornerSeenMarker.find_by(account: viewer, korner_slug: slug)
      expect(marker.baseline_id).to eq(newest.id)
      expect(KornerContentView.where(account: viewer, korner_slug: slug)).to be_empty
    end
  end

  describe '.unread_count / .counts_for' do
    it 'counts feed-visible korner posts above the baseline' do
      korner_status
      korner_status
      expect(described_class.unread_count(viewer, slug)).to eq(2)
    end

    it 'excludes the viewer own posts' do
      korner_status(account: viewer)
      korner_status
      expect(described_class.unread_count(viewer, slug)).to eq(1)
    end

    it 'excludes individually-seen posts' do
      seen = korner_status
      korner_status
      described_class.mark_seen(viewer, slug, seen.id)
      expect(described_class.unread_count(viewer, slug)).to eq(1)
    end

    it 'excludes posts at or below the baseline' do
      korner_status
      described_class.mark_all_seen(viewer, slug)
      korner_status # fresh post above the baseline
      expect(described_class.unread_count(viewer, slug)).to eq(1)
    end

    it 'excludes posts from accounts the viewer does not follow' do
      stranger = Fabricate(:account)
      korner_status(account: stranger)
      expect(described_class.unread_count(viewer, slug)).to eq(0)
    end

    it 'returns 0 for an anonymous (nil) account' do
      korner_status
      expect(described_class.counts_for(nil, [slug])).to eq({})
    end

    it 'batches counts across several korners' do
      korner_status
      result = described_class.counts_for(viewer, [slug, 'kalendar'])
      expect(result[slug]).to eq(1)
      expect(result['kalendar']).to eq(0)
    end
  end
end
