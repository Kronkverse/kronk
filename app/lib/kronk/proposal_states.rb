# frozen_string_literal: true

module Kronk
  # The proposal lifecycle. The only sanctioned way to move a proposal
  # between states.
  #
  #   open ──dev──> delivered ──proposer──> completed   refund + payout
  #    │
  #    └──dev──> annulled                               refund, no payout
  #
  # Two deliberate asymmetries:
  #
  # `deliver!` and `annul!` are back-end only — they are reached through
  # `tootctl kommons`, not through the API. Access is governed by who can
  # get a shell on the server rather than by a role check, so there is no
  # in-app surface to find or mis-permission.
  #
  # There is no delivered -> annulled edge. Once delivered, the only way out
  # is the proposer completing it; a problem found after delivery is a new
  # proposal.
  module ProposalStates
    module_function

    InvalidTransition = Class.new(StandardError)
    NotTheProposer = Class.new(StandardError)

    # open -> delivered. A dev has built the thing and is handing it back to
    # the proposer to confirm. No tokens move; backing simply closes.
    def deliver!(proposal)
      require_state!(proposal, 'open', 'deliver')

      proposal.update!(status: :delivered)
      notify_proposer(proposal)
      proposal
    end

    # delivered -> completed. Only the proposer, and only from delivered.
    # This is what returns the stakes and pays the author.
    def complete!(proposal, by:)
      require_state!(proposal, 'delivered', 'complete')
      raise NotTheProposer, 'only the proposer can complete a proposal' unless by.id == proposal.created_by_account_id

      ActiveRecord::Base.transaction do
        proposal.update!(status: :completed)
        Kronk::Tokens.refund_all!(proposal)
        Kronk::Tokens.pay_author!(proposal)
      end

      proposal
    end

    # open -> annulled. The release valve: without it, a backed proposal that
    # never ships would lock its backers' tokens forever. Stakes return; the
    # author is paid nothing.
    def annul!(proposal)
      require_state!(proposal, 'open', 'annul')

      ActiveRecord::Base.transaction do
        proposal.update!(status: :annulled)
        Kronk::Tokens.refund_all!(proposal)
      end

      proposal
    end

    # Backing closes at delivered — the work is done, so there is nothing
    # left to signal support for.
    def backable?(proposal)
      proposal.open?
    end

    def require_state!(proposal, expected, action)
      return if proposal.status == expected

      raise InvalidTransition, "cannot #{action} a proposal that is #{proposal.status} (expected #{expected})"
    end

    # Written directly rather than through NotifyService. That service is
    # built around social interactions — it reads `from_account.local?` and
    # the sender's user role to decide filtering — and a state change has no
    # social sender. Passing a Proposal through it raises NoMethodError on
    # nil. `notifications.from_account_id` is NOT NULL, so the instance's
    # representative account stands in as the sender, which is the same
    # convention Relay and the admin system checks use.
    #
    # Deliberately non-fatal: a notification failing must never leave a
    # proposal half-transitioned. The state change is the contract, the
    # nudge is a courtesy.
    def notify_proposer(proposal)
      Notification.create!(
        account_id: proposal.created_by_account_id,
        from_account: Account.representative,
        activity: proposal,
        type: 'proposal_status_changed'
      )
    rescue StandardError => e
      Rails.logger.error("Failed to notify proposer of proposal #{proposal.id}: #{e.class} #{e.message}")
    end
  end
end
