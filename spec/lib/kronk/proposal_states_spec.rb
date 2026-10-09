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

    it 'stays true once claimed' do
      proposal.update!(status: :claimed)
      expect(described_class.backable?(proposal)).to be(true)
    end

    it 'is false once actioned' do
      proposal.update!(status: :actioned)
      expect(described_class.backable?(proposal)).to be(false)
    end
  end

  describe '.claim!' do
    let(:dev) { Fabricate(:account) }

    it 'moves an open proposal to claimed and records who and when' do
      described_class.claim!(proposal, by: dev)

      expect(proposal.reload).to have_attributes(status: 'claimed', claimed_by_account_id: dev.id)
      expect(proposal.claimed_at).to be_present
    end

    it 'lets the proposer claim their own proposal' do
      described_class.claim!(proposal, by: account)
      expect(proposal.reload.claimed_by_account_id).to eq(account.id)
    end

    it 'refuses a second claim while one stands' do
      described_class.claim!(proposal, by: dev)

      expect { described_class.claim!(proposal, by: Fabricate(:account)) }
        .to raise_error(described_class::InvalidTransition)
      expect(proposal.reload.claimed_by_account_id).to eq(dev.id)
    end

    it 'refuses to claim an actioned proposal' do
      proposal.update!(status: :actioned)
      expect { described_class.claim!(proposal, by: dev) }.to raise_error(described_class::InvalidTransition)
    end

    it 'publishes kommons.proposal.claimed addressed to the proposer' do
      received = nil
      Kronk::KornerEvents.subscribe('kommons.proposal.claimed') { |payload| received = payload }

      described_class.claim!(proposal, by: dev)

      expect(received).to include(proposal_id: proposal.id, actor_account_id: dev.id, recipient_account_id: account.id)
    ensure
      Kronk::KornerEvents.reset!
    end
  end

  describe '.unclaim!' do
    let(:dev) { Fabricate(:account) }

    before { described_class.claim!(proposal, by: dev) }

    it 'returns the proposal to open and clears the claim' do
      described_class.unclaim!(proposal, by: dev)
      expect(proposal.reload).to have_attributes(status: 'open', claimed_by_account_id: nil, claimed_at: nil)
    end

    it 'refuses anyone but the claimant, the proposer included' do
      expect { described_class.unclaim!(proposal, by: account) }
        .to raise_error(described_class::NotTheClaimant)
      expect(proposal.reload.status).to eq('claimed')
    end

    it 'refuses a proposal that is not claimed' do
      described_class.unclaim!(proposal, by: dev)
      expect { described_class.unclaim!(proposal, by: dev) }.to raise_error(described_class::InvalidTransition)
    end
  end

  describe '.action!' do
    let(:dev) { Fabricate(:account) }

    context 'without by: (the back end)' do
      it 'actions an open proposal and notifies the proposer' do
        expect { described_class.action!(proposal) }
          .to change { status_notifications_for(account.id).count }.by(1)
        expect(proposal.reload.status).to eq('actioned')
      end

      it 'actions a claimed proposal and keeps the claimant on record' do
        described_class.claim!(proposal, by: dev)

        described_class.action!(proposal)

        expect(proposal.reload).to have_attributes(status: 'actioned', claimed_by_account_id: dev.id)
      end
    end

    context 'with by: (a member in the app)' do
      it 'lets the claimant action a claimed proposal' do
        described_class.claim!(proposal, by: dev)

        described_class.action!(proposal, by: dev)

        expect(proposal.reload.status).to eq('actioned')
      end

      it 'refuses anyone but the claimant' do
        described_class.claim!(proposal, by: dev)

        expect { described_class.action!(proposal, by: Fabricate(:account)) }
          .to raise_error(described_class::NotTheClaimant)
        expect(proposal.reload.status).to eq('claimed')
      end

      # The anti-gaming line: the proposer is the one who closes and gets
      # paid, so they can never also be the one saying the work is done.
      it 'refuses the proposer even when they are the claimant' do
        described_class.claim!(proposal, by: account)

        expect { described_class.action!(proposal, by: account) }
          .to raise_error(described_class::ProposerCannotAction)
        expect(proposal.reload.status).to eq('claimed')
      end

      it 'refuses an unclaimed proposal' do
        expect { described_class.action!(proposal, by: dev) }
          .to raise_error(described_class::InvalidTransition)
      end
    end
  end

  describe '.close!' do
    it 'rejects closing a proposal that is not actioned (the in-app 422 case)' do
      expect { described_class.close!(proposal, by: account) }
        .to raise_error(described_class::InvalidTransition)
    end

    it 'rejects closing by someone other than the proposer' do
      proposal.update!(status: :actioned)
      other = Fabricate(:account)

      expect { described_class.close!(proposal, by: other) }
        .to raise_error(described_class::NotTheProposer)
    end

    it 'notifies the proposer when the transition succeeds' do
      proposal.update!(status: :actioned)

      expect { described_class.close!(proposal, by: account) }
        .to change { status_notifications_for(account.id).count }.by(1)
    end

    it 'keeps the proposer’s outcome notes' do
      proposal.update!(status: :actioned)

      described_class.close!(proposal, by: account, outcome_notes: 'Shipped in 2.0.3')

      expect(proposal.reload).to have_attributes(status: 'closed', outcome_notes: 'Shipped in 2.0.3')
    end

    it 'publishes kommons.proposal.closed on the KornerEvents bus' do
      proposal.update!(status: :actioned)
      received = nil
      Kronk::KornerEvents.subscribe('kommons.proposal.closed') { |payload| received = payload }

      described_class.close!(proposal, by: account)

      expect(received).to include(proposal_id: proposal.id, author_account_id: account.id, status: 'closed')
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

    it 'annuls a claimed proposal too' do
      described_class.claim!(proposal, by: Fabricate(:account))
      described_class.annul!(proposal)
      expect(proposal.reload.status).to eq('annulled')
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
