# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::ProposalStates do
  let(:account) { Fabricate(:account) }
  let(:proposal) do
    Proposal.create!(title: 'Add a thing', body: 'It would help.', created_by_account_id: account.id)
  end

  # Notifications go on Notification.type='proposal_status_changed';
  # helper reads them once per example rather than repeating the query.
  def status_notifications_for(account_id)
    Notification.where(account_id: account_id, type: 'proposal_status_changed')
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

  describe '.deliver!' do
    it 'notifies the proposer that their proposal is delivered' do
      expect { described_class.deliver!(proposal) }
        .to change { status_notifications_for(account.id).count }.by(1)
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

    it 'notifies the proposer when the transition succeeds' do
      proposal.update!(status: :delivered)

      expect { described_class.complete!(proposal, by: account) }
        .to change { status_notifications_for(account.id).count }.by(1)
    end

    it 'publishes kommons.proposal.completed on the KornerEvents bus' do
      proposal.update!(status: :delivered)
      received = nil
      Kronk::KornerEvents.subscribe('kommons.proposal.completed') { |payload| received = payload }

      described_class.complete!(proposal, by: account)

      expect(received).to include(proposal_id: proposal.id, author_account_id: account.id, status: 'completed')
    ensure
      Kronk::KornerEvents.reset!
    end
  end

  describe '.annul!' do
    let(:backer) { Fabricate(:account) }

    before { Kronk::Tokens.back!(backer, proposal, 3) }

    it 'refunds every backer' do
      expect { described_class.annul!(proposal) }
        .to change { Kronk::Tokens.balance_of(backer) }.by(3)
    end

    it 'notifies the proposer' do
      expect { described_class.annul!(proposal) }
        .to change { status_notifications_for(account.id).count }.by(1)
    end

    it 'publishes kommons.proposal.annulled on the KornerEvents bus' do
      received = nil
      Kronk::KornerEvents.subscribe('kommons.proposal.annulled') { |payload| received = payload }

      described_class.annul!(proposal)

      expect(received).to include(proposal_id: proposal.id, author_account_id: account.id, status: 'annulled')
    ensure
      Kronk::KornerEvents.reset!
    end
  end
end
