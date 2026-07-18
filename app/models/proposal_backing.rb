# frozen_string_literal: true

# One investment of tokens in a proposal.
#
# Not unique per (proposal, account) — backers may top up, so conviction is
# expressed as several rows and a backer's stake is their sum. Rows are
# never edited; a refund is recorded as a TokenTransaction, not by mutating
# or deleting the backing that earned it.
class ProposalBacking < ApplicationRecord
  belongs_to :proposal
  belongs_to :account

  validates :amount, numericality: { greater_than: 0, only_integer: true }

  scope :for_account, ->(account_id) { where(account_id: account_id) }

  def self.total_for(proposal_id)
    where(proposal_id: proposal_id).sum(:amount)
  end

  def self.stake_of(proposal_id, account_id)
    where(proposal_id: proposal_id, account_id: account_id).sum(:amount)
  end

  def self.backer_totals(proposal_id)
    where(proposal_id: proposal_id).group(:account_id).sum(:amount)
  end
end
