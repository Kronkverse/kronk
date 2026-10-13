# frozen_string_literal: true

# The nudges around asking to join a Krew. Published on the korner event
# bus; config/korners/nudges.yaml routes both as directed, since the asker
# and the Krew's members need not be Mates.
module Kronk
  module KrewJoinRequests
    module_function

    # Someone asked to join: tell every member, since any of them can let
    # the person in. One event per member, because a listen routes to the
    # single `recipient_account_id` in its payload.
    def notify_requested(krew, asker)
      krew.krew_memberships.where.not(account_id: asker.id).pluck(:account_id).each do |member_id|
        Kronk::KornerEvents.publish(
          'krews.join.requested',
          actor_account_id: asker.id,
          recipient_account_id: member_id,
          krew_id: krew.id,
          krew_slug: krew.slug
        )
      end
    end

    # A member let them in: tell the person who asked.
    def notify_accepted(krew, asker, by:)
      Kronk::KornerEvents.publish(
        'krews.join.accepted',
        actor_account_id: by.id,
        recipient_account_id: asker.id,
        krew_id: krew.id,
        krew_slug: krew.slug
      )
    end
  end
end
