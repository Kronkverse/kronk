# frozen_string_literal: true

# One row per (account, question) — the viewer has swiped-left in the
# Kuestions deck and doesn't want to see this Kuestion again. The row
# never blocks the underlying Question or its answers; it just
# suppresses the card in `Question.deck_for(account)`.
class QuestionSkip < ApplicationRecord
  belongs_to :account
  belongs_to :question

  validates :account_id, uniqueness: { scope: :question_id }

  before_validation :ensure_created_at, on: :create

  private

  def ensure_created_at
    self.created_at ||= Time.current
  end
end
