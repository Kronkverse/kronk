# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Proposal do
  let(:account) { Fabricate(:account) }

  describe 'lifecycle state vs discussion thread' do
    # Regression: `belongs_to :status` shadowed `enum :status`, so the
    # association writer and reader both won. Creating a proposal raised
    # AssociationTypeMismatch, and `proposal.status` returned a Status object
    # where the serializer and the governance UI expect the enum string.
    it 'assigns the lifecycle state without raising' do
      expect do
        described_class.new(title: 'T', body: 'B', created_by_account: account, status: :open)
      end.to_not raise_error
    end

    it 'reads the lifecycle state as the enum string' do
      proposal = described_class.new(title: 'T', body: 'B', created_by_account: account, status: :open)

      expect(proposal.status).to eq('open')
    end

    it 'exposes the discussion thread separately from the state' do
      proposal = described_class.new(title: 'T', body: 'B', created_by_account: account, status: :open)

      expect(proposal).to respond_to(:discussion)
      expect(proposal.status).to_not be_a(Status)
    end

    it 'keeps status_id as the canonical discussion column' do
      status = Fabricate(:status, account: account)
      proposal = described_class.new(title: 'T', body: 'B', created_by_account: account, status: :open, discussion: status)

      expect(proposal.status_id).to eq(status.id)
    end
  end

  describe 'node_id' do
    it 'rejects an unregistered node id' do
      proposal = described_class.new(title: 'T', body: 'B', created_by_account: account, status: :open, node_id: 'not-a-node')

      expect(proposal).to_not be_valid
      expect(proposal.errors[:node_id]).to_not be_empty
    end

    it 'allows a nil node id' do
      proposal = described_class.new(title: 'T', body: 'B', created_by_account: account, status: :open, node_id: nil)

      expect(proposal).to be_valid
    end
  end
end
