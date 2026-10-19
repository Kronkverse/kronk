# frozen_string_literal: true

module Kronk
  # The proposal lifecycle. The only sanctioned way to move a proposal
  # between states.
  #
  #   open ──anyone claims──> claimed ──claimant──> actioned ──proposer──> closed   refund + payout
  #    │  <──claimant unclaims──┘ │
  #    │                         │
  #    └──dev──> annulled <──dev─┘                                              refund, no payout
  #
  # `open` can also go straight to actioned from the back end: the shell
  # (`tootctl kommons action`) and a steward's last-task tick need no claim.
  #
  # Who may do what:
  #
  # - Claim/unclaim: any signed-in member, in the app. Moves no tokens.
  # - Action: the claimant in the app, once their work has merged to main —
  #   but never the proposer, even if they claimed their own proposal. That
  #   is the anti-gaming line: whoever closes (and so gets paid) can't also be
  #   the one who says the work is done. A proposer building their own
  #   proposal gets it actioned by a steward or the shell.
  # - Close: the proposer only, in the app.
  # - Annul: the shell only. No in-app surface to find or mis-permission.
  #
  # There is no actioned -> annulled edge. Once actioned, the only way out is
  # the proposer closing it; a problem found afterwards is a new proposal.
  module ProposalStates
    module_function

    InvalidTransition = Class.new(StandardError)
    NotTheProposer = Class.new(StandardError)
    NotTheClaimant = Class.new(StandardError)
    ProposerCannotAction = Class.new(StandardError)

    # open -> claimed. Anyone signed in, proposer included (building your own
    # proposal is fine; actioning it is what's guarded). One claimant at a
    # time: the row lock makes two simultaneous claims resolve to one winner
    # and one InvalidTransition.
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
    # proposal simply goes back on the board for someone else. Unless others
    # have joined: then it stays claimed, and whoever joined first takes it on.
    def unclaim!(proposal, by:)
      proposal.with_lock do
        require_state!(proposal, 'claimed', 'unclaim')
        raise NotTheClaimant, 'only the claimant can unclaim a proposal' unless by.id == proposal.claimed_by_account_id

        heir = proposal.joins.first
        if heir
          proposal.update!(claimed_by_account_id: heir.account_id, claimed_at: Time.now.utc)
          heir.destroy!
        else
          proposal.update!(status: :open, claimed_by_account_id: nil, claimed_at: nil)
        end
      end
      proposal
    end

    # Working on a claimed proposal alongside its claimant. Anyone signed in.
    # Asking twice, or the claimant asking, changes nothing. The claimant is
    # told the first time.
    def join!(proposal, by:)
      joined = proposal.with_lock do
        require_state!(proposal, 'claimed', 'join')
        next false if by.id == proposal.claimed_by_account_id || proposal.joins.exists?(account_id: by.id)

        proposal.joins.create!(account: by)
        true
      end

      if joined
        Kronk::KornerEvents.publish(
          'kommons.proposal.joined',
          actor_account_id: by.id,
          recipient_account_id: proposal.claimed_by_account_id,
          proposal_id: proposal.id
        )
      end
      proposal
    end

    # Stepping back from a proposal you joined. The claimant uses unclaim!.
    def leave!(proposal, by:)
      proposal.joins.where(account_id: by.id).destroy_all
      proposal
    end

    # -> actioned. The work is built and handed back to the proposer to
    # confirm. No tokens move; backing simply closes.
    #
    # `by:` is who did it in the app. With it, only the claimant of a claimed
    # proposal may action, and never the proposer. Without it (`by: nil`) it's
    # the back end — the shell or a steward's last-task tick — which may action
    # an open or claimed proposal.
    def action!(proposal, by: nil)
      proposal.with_lock do
        if by
          require_state!(proposal, 'claimed', 'action')
          raise NotTheClaimant, 'only the claimant can mark a proposal actioned' unless by.id == proposal.claimed_by_account_id
          raise ProposerCannotAction, 'a proposer cannot mark their own proposal actioned' if by.id == proposal.created_by_account_id
        else
          require_state!(proposal, Proposal::ACTIVE_STATES, 'action')
        end

        proposal.update!(status: :actioned)
      end

      notify_proposer(proposal)
      proposal
    end

    # actioned -> closed. Only the proposer, and only from actioned. This is
    # what returns the stakes and pays the author. `outcome_notes` is the
    # proposer's optional word on how it turned out.
    #
    # The row lock makes the state check and the payout one step: two closes
    # at once used to both pass the check and both refund and pay. The
    # proposer did the closing, so they aren't notified of it.
    def close!(proposal, by:, outcome_notes: nil)
      raise NotTheProposer, 'only the proposer can close a proposal' unless by.id == proposal.created_by_account_id

      proposal.with_lock do
        require_state!(proposal, 'actioned', 'close')
        proposal.update!({ status: :closed, outcome_notes: outcome_notes.presence }.compact)
        Kronk::Tokens.refund_all!(proposal)
        Kronk::Tokens.pay_author!(proposal)
      end

      announce_status_change(proposal, 'closed')
      proposal
    end

    # open/claimed -> annulled. The release valve: without it, a backed
    # proposal that never ships would lock its backers' tokens forever. Stakes
    # return; the author is paid nothing.
    def annul!(proposal)
      proposal.with_lock do
        require_state!(proposal, Proposal::ACTIVE_STATES, 'annul')
        proposal.update!(status: :annulled)
        Kronk::Tokens.refund_all!(proposal)
      end

      notify_proposer(proposal)
      announce_status_change(proposal, 'annulled')
      proposal
    end

    # Backing closes at actioned — the work is done, so there is nothing
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
      return if Nudges::MuteCatalogue.notification_muted?(proposal.created_by_account, 'proposal_status_changed')

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
    # transition. `action!` fires no bus event on purpose — backing is
    # still open until actioning closes it, and the proposer already gets
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
