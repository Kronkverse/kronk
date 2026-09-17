# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::AudienceScope do
  let(:viewer) { Fabricate(:account) }
  let(:own_status)      { Fabricate(:status, account: viewer) }
  let(:mate_status)     { Fabricate(:status, account: mate) }
  let(:stranger_status) { Fabricate(:status, account: stranger) }
  let(:statuses)        { [own_status, mate_status, stranger_status] }
  let(:mate)     { Fabricate(:account) }
  let(:stranger) { Fabricate(:account) }

  before do
    # Mutual follow => mate; one-way follow => not a mate.
    viewer.follow!(mate)
    mate.follow!(viewer)
    viewer.follow!(stranger)
  end

  describe '.filter_statuses' do
    it 'passes everything through for orbit' do
      expect(described_class.filter_statuses(viewer, statuses, 'orbit')).to eq(statuses)
    end

    it 'passes everything through for kommunity (served elsewhere)' do
      expect(described_class.filter_statuses(viewer, statuses, 'kommunity')).to eq(statuses)
    end

    it 'returns only the viewer own posts for me' do
      expect(described_class.filter_statuses(viewer, statuses, 'me')).to eq([own_status])
    end

    it 'returns mates posts plus the viewer own for mates' do
      expect(described_class.filter_statuses(viewer, statuses, 'mates')).to contain_exactly(own_status, mate_status)
    end

    it 'excludes one-way follows (non-mates) from mates' do
      expect(described_class.filter_statuses(viewer, statuses, 'mates')).to_not include(stranger_status)
    end

    it 'preserves the original order' do
      expect(described_class.filter_statuses(viewer, statuses, 'mates')).to eq([own_status, mate_status])
    end

    it 'passes through unchanged when the viewer is nil' do
      expect(described_class.filter_statuses(nil, statuses, 'me')).to eq(statuses)
    end

    it 'handles an empty collection' do
      expect(described_class.filter_statuses(viewer, [], 'mates')).to eq([])
    end
  end
end
