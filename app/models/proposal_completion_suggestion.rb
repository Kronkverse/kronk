# frozen_string_literal: true

# A signal from a non-creator peer that they believe a proposal has been
# delivered. Records the suggester so the creator sees who has raised
# it. The suggestion does NOT change proposal status — the creator (or
# a steward) still has to hit "Mark as delivered" to actually deliver.
class ProposalCompletionSuggestion < ApplicationRecord
  belongs_to :proposal
  belongs_to :account

  validates :account_id, uniqueness: { scope: :proposal_id }
  validate  :not_by_creator

  private

  def not_by_creator
    return if proposal.blank? || account_id.blank?

    errors.add(:account_id, 'creator cannot suggest their own proposal as completed') if proposal.created_by_account_id == account_id
  end
end
