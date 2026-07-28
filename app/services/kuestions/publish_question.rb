# frozen_string_literal: true

# Kuestions::PublishQuestion — creates the companion Status that renders
# as the `kuestions_card` in the feed. Called from
# KuestionsController#create and re-used by the backfill migration for
# existing Question rows that predate the feed projection.
#
# Idempotent: if the Question already has a status_id, this is a no-op.
# Kuestions are inherently public per manifest (default_visibility: public)
# so the projection ignores the account's default_privacy — the question
# itself must be reachable by anyone the deck can serve it to; the
# answer-before-view gate lives on the answers, not the ask.
module Kuestions
  class PublishQuestion
    def initialize(question)
      @question = question
    end

    def call
      return @question if @question.status_id.present?

      account = @question.created_by_account
      status = PostStatusService.new.call(
        account,
        text: @question.title,
        visibility: 'public'
      )

      @question.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'kuestions') # feed projection discriminator (§3.2)

      @question
    end
  end
end
