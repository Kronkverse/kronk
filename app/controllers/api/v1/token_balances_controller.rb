# frozen_string_literal: true

# The signed-in account's Kommons token (₭oin) balance — read-only, for the
# balance counter on the Kommons surface. Backing/refund/payout arithmetic
# lives in Kronk::Tokens; this only reports the current spendable figure.
class Api::V1::TokenBalancesController < Api::BaseController
  before_action :require_user!

  def show
    render json: { balance: Kronk::Tokens.balance_of(current_account) }
  end
end
