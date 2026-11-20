# frozen_string_literal: true

# Kronk — Mateship. What two Mates share, for the page only they can open
# (`/@:acct/mateship`; docs/spaces/profile.md (Mateship), decisions.md
# 2026-11-19). Shared things, never measures: no counts of froths, messages
# or visits between them.
#
#   Mates::MateshipService.new(viewer, other).call
#   # => nil when they aren't Mates, else
#   #    { since:, matuals:, matuals_count:, krews:, events:, projekts: }
#
# Every record is one the viewer can already see: Krews they're in, events
# visible to them (Event.visible_to), projekts visible to them
# (Freethedream::Project.visible_to).
module Mates
  class MateshipService < BaseService
    MATUALS_LIMIT = 24
    RECORD_LIMIT = 24

    def call(viewer, other)
      @viewer = viewer
      @other = other

      return if @viewer.nil? || @other.nil? || @viewer.id == @other.id
      return unless @viewer.mate?(@other)

      {
        since: since,
        matuals: matuals.limit(MATUALS_LIMIT).to_a,
        matuals_count: matuals.count,
        krews: krews.to_a,
        events: events.to_a,
        projekts: projekts.to_a,
      }
    end

    private

    # Mates from the moment the second follow was made: the later of the
    # two Follow rows is when the request was accepted.
    def since
      Follow.where(account: @viewer, target_account: @other)
            .or(Follow.where(account: @other, target_account: @viewer))
            .maximum(:created_at)
    end

    # The same rule as the Matuals row (Api::V1::Accounts::MatualsController):
    # nothing in common is shown when the other hides their connections.
    def matuals
      return Account.none if @other.hides_followers? || @other.unavailable?

      @matuals ||= @viewer.mates
                          .where(id: @other.mates.select(:id))
                          .not_excluded_by_account(@viewer)
                          .order(:username)
    end

    def krews
      Krew.active
          .where(id: KrewMembership.where(account_id: @viewer.id).select(:krew_id))
          .where(id: KrewMembership.where(account_id: @other.id).select(:krew_id))
          .order(last_activity_at: :desc)
          .limit(RECORD_LIMIT)
    end

    # Events both said they're going to, newest first.
    def events
      Event.visible_to(@viewer)
           .not_cancelled
           .where(id: going(@viewer))
           .where(id: going(@other))
           .includes(:image)
           .order(start_time: :desc)
           .limit(RECORD_LIMIT)
    end

    def going(account)
      EventRsvp.where(account_id: account.id, status: :going).select(:event_id)
    end

    def projekts
      Freethedream::Project.visible_to(@viewer)
                           .top_level
                           .where(id: member_of(@viewer))
                           .where(id: member_of(@other))
                           .includes(:cover, :krew)
                           .recent
                           .limit(RECORD_LIMIT)
    end

    def member_of(account)
      Freethedream::Membership.member.where(account_id: account.id).select(:project_id)
    end
  end
end
