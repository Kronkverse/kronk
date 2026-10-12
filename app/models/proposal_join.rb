# frozen_string_literal: true

# == Schema Information
#
# Table name: proposal_joins
#
#  id          :bigint(8)        not null, primary key
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  account_id  :bigint(8)        not null
#  proposal_id :bigint(8)        not null
#

# Someone working on a claimed proposal alongside its claimant. See
# Kronk::ProposalStates.join! / leave!.
class ProposalJoin < ApplicationRecord
  belongs_to :proposal
  belongs_to :account

  validates :account_id, uniqueness: { scope: :proposal_id }
end
