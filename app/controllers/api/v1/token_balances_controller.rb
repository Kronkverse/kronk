# frozen_string_literal: true

# The signed-in account's Kommons token (₭oin) wallet — read-only, for the
# balance card on the Kommons surface. All arithmetic lives in Kronk::Tokens;
# this only reports the current picture:
#
#   available    — spendable balance right now
#   staked       — tokens currently locked behind still-open proposals
#   staked_seeds — how many proposals those tokens are spread across
#   total        — available + staked (what returns to you once seeds resolve)
#
# Backings are never deleted (a refund is a TokenTransaction), so "staked" is
# derived from backings whose proposal is still live (open or delivered) —
# terminal proposals have already returned their stakes to `available`.
class Api::V1::TokenBalancesController < Api::BaseController
  before_action :require_user!

  LIVE_STATUSES = Proposal.statuses.values_at('open', 'delivered').freeze

  def show
    available = Kronk::Tokens.balance_of(current_account)

    live = ProposalBacking
           .for_account(current_account.id)
           .joins(:proposal)
           .where(proposals: { status: LIVE_STATUSES })

    staked = live.sum(:amount)
    staked_seeds = live.distinct.count(:proposal_id)

    render json: {
      available: available,
      staked: staked,
      staked_seeds: staked_seeds,
      total: available + staked,
    }
  end
end
