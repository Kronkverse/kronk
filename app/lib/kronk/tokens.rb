# frozen_string_literal: true

module Kronk
  # The only sanctioned way to move tokens.
  #
  # Every operation takes a row lock on the balance and writes the balance
  # change and its transaction in one database transaction, so a balance can
  # never drift from its audit trail and two concurrent backings cannot both
  # read the same balance and overspend it.
  #
  # This module owns arithmetic only. It deliberately knows nothing about
  # proposal state — completing or annulling a proposal calls `refund_all!`
  # and `pay_author!`, but the decision to do so lives with the state machine.
  module Tokens
    module_function

    InsufficientBalance = Class.new(StandardError)
    InvalidAmount = Class.new(StandardError)

    STARTING_BALANCE = TokenBalance::STARTING_BALANCE

    # Issue tokens to an account. Used for the starting balance and for any
    # future issuance. Not tied to a proposal.
    def grant!(account, amount, kind: :grant)
      raise InvalidAmount, 'amount must be positive' unless amount.to_i.positive?

      apply!(account, amount.to_i, kind: kind, proposal: nil)
    end

    # Commit tokens to a proposal. Tokens are locked once committed — there
    # is no un-back. They return on completion or annulment.
    #
    # Records a ProposalBacking as well as the transaction: the transaction
    # says tokens moved, the backing says whose stake it is.
    def back!(account, proposal, amount)
      amount = amount.to_i
      raise InvalidAmount, 'amount must be positive' unless amount.positive?

      ActiveRecord::Base.transaction do
        balance = lock_balance(account)
        raise InsufficientBalance, "balance #{balance.balance}, tried to back #{amount}" if balance.balance < amount

        balance.update!(balance: balance.balance - amount)

        TokenTransaction.create!(account_id: account.id, amount: -amount, kind: :backing, proposal_id: proposal.id)
        ProposalBacking.create!(proposal_id: proposal.id, account_id: account.id, amount: amount)
      end

      # Announce on the cross-korner bus — Nudges listens and routes to
      # the proposal author's Mate conversation with the backer (if
      # they are Mates). Published outside the transaction so a
      # subscriber failure never rolls back the token movement.
      Kronk::KornerEvents.publish(
        'kommons.proposal.backed',
        actor_account_id: account.id,
        recipient_account_id: proposal.created_by_account_id,
        proposal_id: proposal.id,
        amount: amount
      )
    end

    # Return every backer's stake in a proposal. Called when a proposal is
    # completed or annulled. Idempotent by design: it refunds the difference
    # between what was backed and what has already been refunded, so a
    # double-fire cannot pay twice.
    def refund_all!(proposal)
      ProposalBacking.backer_totals(proposal.id).sum do |account_id, backed|
        already = TokenTransaction.for_proposal(proposal.id)
                                  .where(account_id: account_id, kind: :refund)
                                  .sum(:amount)
        owed = backed - already
        next 0 unless owed.positive?

        account = Account.find(account_id)
        apply!(account, owed, kind: :refund, proposal: proposal)
        owed
      end
    end

    # The author's reward on completion, scaled to the backing the proposal
    # attracted: max(1, floor(total / 10)). Paid from the Kronk pool, not
    # from the backers — their stakes are returned in full by refund_all!.
    def pay_author!(proposal)
      total = ProposalBacking.total_for(proposal.id)
      amount = author_payout_for(total)

      already = TokenTransaction.for_proposal(proposal.id).exists?(kind: :payout)
      return 0 if already

      apply!(proposal.created_by_account, amount, kind: :payout, proposal: proposal)
      amount
    end

    def author_payout_for(total_backed)
      [1, total_backed.to_i / 10].max
    end

    def balance_of(account)
      TokenBalance.for(account).balance
    end

    def apply!(account, amount, kind:, proposal:)
      ActiveRecord::Base.transaction do
        balance = lock_balance(account)
        balance.update!(balance: balance.balance + amount)

        TokenTransaction.create!(
          account_id: account.id,
          amount: amount,
          kind: kind,
          proposal_id: proposal&.id
        )
      end
    end

    def lock_balance(account)
      TokenBalance.for(account)
      TokenBalance.lock.find_by!(account_id: account.id)
    end
  end
end
