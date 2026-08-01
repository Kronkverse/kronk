# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::KornerContentStreams do
  let(:viewer) { Fabricate(:account) }

  describe '.for' do
    it 'returns the default status-backed stream for an ordinary korner' do
      expect(described_class.for('kommons')).to be_a(described_class::SourceKornerStream)
    end

    it 'returns the Moments override for the moments slug' do
      expect(described_class.for('moments')).to be_a(described_class::MomentStream)
    end

    it 'accepts a symbol slug' do
      expect(described_class.for(:kommons)).to be_a(described_class::SourceKornerStream)
    end
  end

  describe described_class::SourceKornerStream do
    subject { described_class.new('kommons') }

    it 'scopes to the korner, excludes replies, and excludes the viewer own posts' do
      sql = subject.unread_relation(viewer, 0, []).to_sql
      expect(sql).to include(%q("statuses"."source_korner" = 'kommons'))
      expect(sql).to include('reply')
      expect(sql).to include(%("statuses"."account_id" != #{viewer.id}))
    end

    it 'reports the newest korner status id, 0 when empty' do
      expect(subject.newest_id(viewer)).to eq(0)
      poster = Fabricate(:account)
      viewer.follow!(poster)
      status = Fabricate(:status, account: poster, source_korner: 'kommons')
      expect(subject.newest_id(viewer)).to eq(status.id)
    end
  end

  describe described_class::MomentStream do
    subject { described_class.new }

    it 'streams live moments, keyed on moment id, excluding the viewer own' do
      sql = subject.unread_relation(viewer, 0, []).to_sql
      expect(sql).to include('moments')
      expect(sql).to include(%("moments"."account_id" != #{viewer.id}))
    end

    it 'reports 0 newest id when there are no moments' do
      expect(subject.newest_id(viewer)).to eq(0)
    end
  end
end
