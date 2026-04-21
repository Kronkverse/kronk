# frozen_string_literal: true

class ProposalVote < ApplicationRecord
  BLOCK_STATEMENT_MIN = 20

  belongs_to :proposal
  belongs_to :account

  has_many :challenge_conditions, dependent: :destroy, inverse_of: :proposal_vote

  enum :position, { agree: 0, abstain: 1, block: 2 }

  validates :position, presence: true
  validates :account_id, uniqueness: { scope: :proposal_id }
  validates :statement, presence: true, length: { minimum: BLOCK_STATEMENT_MIN }, if: :block?
end
