# frozen_string_literal: true

# Trimmed shape of a Question for timeline embedding on the shared status.
# The full REST::Kuestions::QuestionSerializer includes the answers list
# (behind the visibility gate) and per-choice aggregate; the feed card
# only needs the header + count + a small avatar strip. Mirrors
# REST::ProposalSummarySerializer / REST::BoothSetSummarySerializer.
class REST::QuestionSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :prompt, :answer_format, :mc_options,
             :answers_count, :locked

  attribute :has_answered
  attribute :recent_answerer_avatars

  def id
    object.id.to_s
  end

  def answers_count
    @answers_count ||= object.answers.count
  end

  def has_answered
    return false unless current_user&.account

    object.answered_by?(current_user.account)
  end

  # Up to 5 avatars of recent answerers, newest first. Deliberately not
  # filtered by the viewer's Mates — the card is an encouragement signal
  # ("people are answering") and the answers themselves stay behind the
  # gate. Avatars are already public on the account.
  def recent_answerer_avatars
    account_ids = object.answers.order(id: :desc).limit(5).pluck(:account_id)
    return [] if account_ids.empty?

    Account.where(id: account_ids).map do |a|
      {
        id: a.id.to_s,
        acct: a.acct,
        avatar: a.avatar_original_url,
      }
    end
  end
end
