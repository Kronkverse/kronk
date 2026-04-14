# frozen_string_literal: true

class ProposalVote < ApplicationRecord
  belongs_to :proposal
  belongs_to :account

  enum :position, { agree: 0, abstain: 1, block: 2 }

  validates :position, presence: true
  validates :account_id, uniqueness: { scope: :proposal_id }
end
