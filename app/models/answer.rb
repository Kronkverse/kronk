# frozen_string_literal: true

# Kuestions v2 dedicated model. One answer per (question, account) —
# enforced by both the unique DB index and the model validation. When
# the parent Question is `locked?`, viewers who haven't answered can
# only see their own answer (via Kuestions::VisibilityGate).
class Answer < ApplicationRecord
  belongs_to :question
  belongs_to :account
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :answer

  validates :body, presence: true
  validates :account_id, uniqueness: { scope: :question_id }

  after_commit :publish_kuestions_question_answered, on: :create

  private

  # kuestions.question.answered — someone answered a Question; Nudges
  # routes to the asker's Mate chat with the answerer (if Mates).
  def publish_kuestions_question_answered
    Kronk::KornerEvents.publish(
      'kuestions.question.answered',
      actor_account_id: account_id,
      recipient_account_id: question.created_by_account_id,
      question_id: question_id,
      answer_id: id
    )
  end
end
