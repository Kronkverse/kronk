# frozen_string_literal: true

require 'rails_helper'

# Cross-cutting spec for §5.5 status linkage (dual-write + read-through).
# The second describe arg names a spec-section, not a Ruby method — the
# same rationale holds for the filename.
# rubocop:disable RSpec/DescribeMethod, RSpec/SpecFilePathFormat
RSpec.describe Proposal, '§5.5 canonical status_id linkage' do
  let(:account) { Fabricate(:account) }
  let(:status)  { Fabricate(:status, account: account) }

  describe 'writes are dual-written to both columns' do
    it 'writing status_id populates discussion_status_id' do
      proposal = Fabricate.build(:proposal, created_by_account: account, status_id: status.id)
      proposal.save!
      expect(proposal[:status_id]).to eq(status.id)
      expect(proposal[:discussion_status_id]).to eq(status.id)
    end

    it 'writing discussion_status_id populates status_id' do
      proposal = Fabricate.build(:proposal, created_by_account: account, discussion_status_id: status.id)
      proposal.save!
      expect(proposal[:discussion_status_id]).to eq(status.id)
      expect(proposal[:status_id]).to eq(status.id)
    end
  end

  describe 'reads' do
    # Was `#status`, which asserted the collision rather than catching it:
    # belongs_to :status shadowed enum :status, so this passed by returning
    # the association while the serializer and the governance UI were reading
    # the same method expecting the lifecycle string. The association is now
    # named :discussion; the canonical §5.5 column status_id is unchanged.
    it 'exposes #discussion returning the linked Status' do
      proposal = Fabricate(:proposal, created_by_account: account, status_id: status.id)
      expect(proposal.discussion).to eq(status)
    end

    it 'keeps #status as the lifecycle enum, not the linked Status' do
      proposal = Fabricate(:proposal, created_by_account: account, status_id: status.id, status: :open)
      expect(proposal.status).to eq('open')
    end

    it 'exposes deprecated #discussion_status returning the same Status' do
      proposal = Fabricate(:proposal, created_by_account: account, status_id: status.id)
      expect(proposal.discussion_status).to eq(status)
    end

    it 'exposes deprecated #discussion_status_id returning the same id' do
      proposal = Fabricate(:proposal, created_by_account: account, status_id: status.id)
      expect(proposal.discussion_status_id).to eq(status.id)
    end
  end

  describe 'Status#proposal association' do
    it 'resolves via the canonical status_id column' do
      proposal = Fabricate(:proposal, created_by_account: account, status_id: status.id)
      expect(status.reload.proposal).to eq(proposal)
    end
  end
end
# rubocop:enable RSpec/DescribeMethod, RSpec/SpecFilePathFormat
