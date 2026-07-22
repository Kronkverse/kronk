# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::ProposalStates do
  let(:account) { Fabricate(:account) }
  let(:proposal) do
    Proposal.create!(title: 'Add a thing', body: 'It would help.', created_by_account_id: account.id)
  end

  describe '.backable?' do
    it 'is true for an open proposal' do
      expect(described_class.backable?(proposal)).to be(true)
    end

    it 'is false once delivered' do
      proposal.update!(status: :delivered)
      expect(described_class.backable?(proposal)).to be(false)
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
