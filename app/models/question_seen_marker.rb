# frozen_string_literal: true

# One row per (account, question): when the account last opened the
# Kuestion's answers. Answers from others after `seen_at` count as new on
# the Answered list (REST::Kuestions::QuestionSerializer#new_answers_count).
class QuestionSeenMarker < ApplicationRecord
  belongs_to :account
  belongs_to :question

  validates :account_id, uniqueness: { scope: :question_id }

  def self.mark!(account, question)
    upsert({ account_id: account.id, question_id: question.id, seen_at: Time.current },
           unique_by: :index_question_seen_markers_on_pair)
  end
end
