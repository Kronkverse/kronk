# frozen_string_literal: true

require 'rails_helper'

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
    it 'exposes #status returning the linked Status' do
      proposal = Fabricate(:proposal, created_by_account: account, status_id: status.id)
      expect(proposal.status).to eq(status)
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
