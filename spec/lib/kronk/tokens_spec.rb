# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::Tokens do
  let(:backer)  { Fabricate(:account) }
  let(:author)  { Fabricate(:account) }
  let(:proposal) { Fabricate(:proposal, created_by_account: author, status: :open) }

  # Accounts are created with a starting balance by the after_create hook,
  # so set balances explicitly rather than assuming the grant.
  def set_balance(account, amount)
    TokenBalance.for(account).update!(balance: amount)
  end

  describe '.back!' do
    before { set_balance(backer, 10) }

    it 'moves tokens out of the balance and records both rows' do
      described_class.back!(backer, proposal, 4)

      expect(described_class.balance_of(backer)).to eq(6)
      expect(ProposalBacking.stake_of(proposal.id, backer.id)).to eq(4)
      expect(TokenTransaction.where(account_id: backer.id, kind: :backing).sum(:amount)).to eq(-4)
    end

    it 'accumulates when a backer tops up' do
      described_class.back!(backer, proposal, 3)
      described_class.back!(backer, proposal, 2)

      expect(ProposalBacking.stake_of(proposal.id, backer.id)).to eq(5)
      expect(ProposalBacking.where(proposal_id: proposal.id, account_id: backer.id).count).to eq(2)
      expect(described_class.balance_of(backer)).to eq(5)
    end

    it 'refuses to overspend' do
      expect { described_class.back!(backer, proposal, 11) }.to raise_error(described_class::InsufficientBalance)
      expect(described_class.balance_of(backer)).to eq(10)
      expect(ProposalBacking.count).to eq(0)
    end

    it 'refuses a non-positive amount' do
      expect { described_class.back!(backer, proposal, 0) }.to raise_error(described_class::InvalidAmount)
      expect { described_class.back!(backer, proposal, -3) }.to raise_error(described_class::InvalidAmount)
    end

    it 'leaves the balance reconciling against its transactions' do
      described_class.back!(backer, proposal, 4)

      expect(TokenBalance.for(backer).reconciles?).to be(true)
    end
  end

  describe '.refund_all!' do
    let(:other) { Fabricate(:account) }

    before do
      set_balance(backer, 10)
      set_balance(other, 10)
      described_class.back!(backer, proposal, 4)
      described_class.back!(other, proposal, 6)
    end

    it 'returns every backer their full stake' do
      described_class.refund_all!(proposal)

      expect(described_class.balance_of(backer)).to eq(10)
      expect(described_class.balance_of(other)).to eq(10)
    end

    it 'is idempotent — a second call pays nothing further' do
      described_class.refund_all!(proposal)
      expect { described_class.refund_all!(proposal) }
        .to_not(change { described_class.balance_of(backer) })

      expect(described_class.balance_of(backer)).to eq(10)
    end

    it 'keeps the backing rows as the record of what was staked' do
      described_class.refund_all!(proposal)

      expect(ProposalBacking.total_for(proposal.id)).to eq(10)
    end
  end

  describe '.author_payout_for' do
    it 'is a tenth of the backing, floored, with a minimum of one' do
      expect(described_class.author_payout_for(80)).to eq(8)
      expect(described_class.author_payout_for(35)).to eq(3)
      expect(described_class.author_payout_for(9)).to eq(1)
      expect(described_class.author_payout_for(0)).to eq(1)
    end
  end

  describe '.pay_author!' do
    before do
      set_balance(backer, 100)
      set_balance(author, 0)
      described_class.back!(backer, proposal, 80)
    end

    it 'pays the author from the pool, not from the backers' do
      described_class.pay_author!(proposal)

      expect(described_class.balance_of(author)).to eq(8)
      # The backer's stake is untouched by the payout — it returns via refund.
      expect(described_class.balance_of(backer)).to eq(20)
    end

    it 'pays only once' do
      described_class.pay_author!(proposal)
      described_class.pay_author!(proposal)

      expect(described_class.balance_of(author)).to eq(8)
    end
  end

  describe '.grant!' do
    it 'credits the account and records a grant' do
      set_balance(backer, 0)
      described_class.grant!(backer, 10)

      expect(described_class.balance_of(backer)).to eq(10)
      expect(TokenTransaction.where(account_id: backer.id, kind: :grant).sum(:amount)).to eq(10)
    end

    it 'refuses a non-positive amount' do
      expect { described_class.grant!(backer, 0) }.to raise_error(described_class::InvalidAmount)
    end
  end

  describe 'the full loop' do
    it 'returns everyone to a coherent state when a proposal completes' do
      set_balance(backer, 10)
      set_balance(author, 0)

      described_class.back!(backer, proposal, 10)
      expect(described_class.balance_of(backer)).to eq(0)

      described_class.refund_all!(proposal)
      described_class.pay_author!(proposal)

      expect(described_class.balance_of(backer)).to eq(10)
      expect(described_class.balance_of(author)).to eq(1)
      expect(TokenBalance.for(backer).reconciles?).to be(true)
      expect(TokenBalance.for(author).reconciles?).to be(true)
    end
  end
end
