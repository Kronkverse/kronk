# frozen_string_literal: true

# Kuestions::PublishQuestion — creates the companion Status that renders
# as the `kuestions_card` in the feed. Called from
# KuestionsController#create and re-used by the backfill migration for
# existing Question rows that predate the feed projection.
#
# Idempotent: if the Question already has a status_id, this is a no-op.
# Profile Kuestions are never published.
# Everyone's Kuestions are inherently public per manifest
# (default_visibility: public) so the projection ignores the account's
# default_privacy — the question itself must be reachable by anyone the
# deck can serve it to; the answer-before-view gate lives on the answers,
# not the ask.
#
# A Kuestion asked in a Krew or projekt goes only to its people (Tal,
# 2026-11-15: "everyone who's in it will see it pop up in their timeline"):
# a Krew's to its members (`self_only` + the Krew, as a Krew post), a
# projekt's to whoever has joined it when it is asked (`self_only` + them,
# added by name), not everyone who can see it.
module Kuestions
  class PublishQuestion
    def initialize(question)
      @question = question
    end

    def call
      return @question if @question.status_id.present?
      # Profile Kuestions are about the person answering, not an ask to
      # the community: no feed card.
      return @question if @question.profile?

      account = @question.created_by_account
      status = PostStatusService.new.call(
        account,
        text: @question.title,
        **audience
      )

      @question.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'kuestions') # feed projection discriminator (§3.2)

      @question
    end

    private

    def audience
      if @question.krew_id.present?
        { visibility: 'self_only', krew_ids: [@question.krew_id] }
      elsif @question.freethedream_project_id.present?
        { visibility: 'self_only', audience_grant_ids: projekt_member_ids }
      else
        { visibility: 'public' }
      end
    end

    def projekt_member_ids
      Freethedream::Membership.member.where(project_id: @question.freethedream_project.top_id).pluck(:account_id)
    end
  end
end
