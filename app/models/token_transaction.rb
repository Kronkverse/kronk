# frozen_string_literal: true

# One movement of tokens. Append-only: never updated, never destroyed.
#
# `amount` is signed — negative spends, positive credits. A balance is
# always the sum of its transactions, which is what makes the ledger
# auditable rather than merely a number that changed.
class TokenTransaction < ApplicationRecord
  belongs_to :account
  belongs_to :proposal, optional: true

  # grant   — the starting balance, or any future issuance
  # backing — tokens committed to a proposal (negative)
  # refund  — tokens returned when a proposal completes or is annulled
  # payout  — the author's reward on completion, from the Kronk pool
  enum :kind, { grant: 0, backing: 1, refund: 2, payout: 3 }

  validates :amount, numericality: { only_integer: true }
  validate  :amount_sign_matches_kind

  scope :for_proposal, ->(proposal_id) { where(proposal_id: proposal_id) }

  private

  def amount_sign_matches_kind
    return if amount.nil?

    if backing?
      errors.add(:amount, 'must be negative for a backing') unless amount.negative?
    elsif amount.negative?
      errors.add(:amount, "must not be negative for a #{kind}")
    end
  end
end
