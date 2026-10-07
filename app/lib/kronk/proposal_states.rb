# frozen_string_literal: true

module Kronk
  # The proposal lifecycle. The only sanctioned way to move a proposal
  # between states.
  #
  #   open ──anyone claims──> claimed ──dev──> delivered ──proposer──> completed   refund + payout
  #    │  <──claimant unclaims──┘ │
  #    │                         │
  #    └──dev──> annulled <──dev─┘                                              refund, no payout
  #
  # (`open` can still go straight to delivered: the shell and a steward's
  # last-task tick don't require a claim first.)
  #
  # Claiming is the one transition open to any signed-in member, through the
  # API: it only says "I'm on this", and moves no tokens. Who gets paid is
  # still decided at delivery, which stays back-end only (below).
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
    NotTheClaimant = Class.new(StandardError)

    # open -> claimed. Anyone signed in, proposer included (building your own
    # proposal is fine; delivery is what's guarded). One claimant at a time:
    # the row lock makes two simultaneous claims resolve to one winner and
    # one InvalidTransition.
    def claim!(proposal, by:)
      proposal.with_lock do
        require_state!(proposal, 'open', 'claim')
        proposal.update!(status: :claimed, claimed_by_account_id: by.id, claimed_at: Time.now.utc)
      end

      Kronk::KornerEvents.publish(
        'kommons.proposal.claimed',
        actor_account_id: by.id,
        recipient_account_id: proposal.created_by_account_id,
        proposal_id: proposal.id
      )
      proposal
    end

    # claimed -> open. Only the claimant. No shame, no partial credit: the
    # proposal simply goes back on the board for someone else.
    def unclaim!(proposal, by:)
      proposal.with_lock do
        require_state!(proposal, 'claimed', 'unclaim')
        raise NotTheClaimant, 'only the claimant can unclaim a proposal' unless by.id == proposal.claimed_by_account_id

        proposal.update!(status: :open, claimed_by_account_id: nil, claimed_at: nil)
      end
      proposal
    end

    # open/claimed -> delivered. A dev has built the thing and is handing it
    # back to the proposer to confirm. No tokens move; backing simply closes.
    def deliver!(proposal)
      require_state!(proposal, Proposal::ACTIVE_STATES, 'deliver')

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

      notify_proposer(proposal)
      announce_status_change(proposal, 'completed')
      proposal
    end

    # open/claimed -> annulled. The release valve: without it, a backed
    # proposal that never ships would lock its backers' tokens forever. Stakes
    # return; the author is paid nothing.
    def annul!(proposal)
      require_state!(proposal, Proposal::ACTIVE_STATES, 'annul')

      ActiveRecord::Base.transaction do
        proposal.update!(status: :annulled)
        Kronk::Tokens.refund_all!(proposal)
      end

      notify_proposer(proposal)
      announce_status_change(proposal, 'annulled')
      proposal
    end

    # Backing closes at delivered — the work is done, so there is nothing
    # left to signal support for. A claim doesn't close it: backing a claimed
    # proposal still says "I want this", and the stake returns either way.
    def backable?(proposal)
      Proposal::ACTIVE_STATES.include?(proposal.status)
    end

    def require_state!(proposal, expected, action)
      allowed = Array(expected)
      return if allowed.include?(proposal.status)

      raise InvalidTransition, "cannot #{action} a proposal that is #{proposal.status} (expected #{allowed.join(' or ')})"
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
    rescue => e
      Rails.logger.error("Failed to notify proposer of proposal #{proposal.id}: #{e.class} #{e.message}")
    end

    # Publish a state transition onto the KornerEvents bus so subscribers
    # (Nudges' backer-notification hook, future analytics, moderator
    # dashboards) can react without ProposalStates having to know about
    # them. Fire-and-forget: a subscriber failure never rolls back the
    # transition. `deliver!` fires no bus event on purpose — backing is
    # still open until delivery closes it, and the proposer already gets
    # the direct notification; the bus events are the backer-visible
    # "the outcome is in" signal.
    def announce_status_change(proposal, new_status)
      Kronk::KornerEvents.publish(
        "kommons.proposal.#{new_status}",
        proposal_id: proposal.id,
        author_account_id: proposal.created_by_account_id,
        status: new_status
      )
    end
  end
end
