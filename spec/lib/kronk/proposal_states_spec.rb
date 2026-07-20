# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::ProposalStates do
  let(:account) { Fabricate(:account) }
  let(:proposal) do
    Proposal.create!(title: 'Add a thing', body: 'It would help.', created_by_account_id: account.id)
  end

  describe '.archive!' do
    it 'archives an unbacked, non-terminal proposal' do
      described_class.archive!(proposal)
      expect(proposal.reload.archived_at).to be_present
    end

    it 'refuses to archive a backed proposal (guard the endpoint bypassed)' do
      allow(proposal).to receive_messages(backed?: true, backing_total: 5)

      expect { described_class.archive!(proposal) }.to raise_error(described_class::StillBacked)
      expect(proposal.reload.archived_at).to be_nil
    end

    it 'refuses to archive a terminal (completed/annulled) proposal' do
      proposal.update!(status: :completed)

      expect { described_class.archive!(proposal) }.to raise_error(described_class::InvalidTransition)
      expect(proposal.reload.archived_at).to be_nil
    end
  end

  describe '.complete!' do
    it 'rejects completing a proposal that is not delivered (the in-app 422 case)' do
      expect { described_class.complete!(proposal, by: account) }
        .to raise_error(described_class::InvalidTransition)
    end

    it 'rejects completion by someone other than the proposer' do
      proposal.update!(status: :delivered)
      other = Fabricate(:account)

      expect { described_class.complete!(proposal, by: other) }
        .to raise_error(described_class::NotTheProposer)
    end
  end
end
