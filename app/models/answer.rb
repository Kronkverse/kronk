# frozen_string_literal: true

# Kuestions v2 dedicated model. One answer per (question, account) —
# enforced by both the unique DB index and the model validation. When
# the parent Question is `locked?`, viewers who haven't answered can
# only see their own answer (via Kuestions::VisibilityGate).
#
# `choice_index` (Phase 1a — 2026-07-22) records the picked option for
# `mc` and `yn` questions. Free-text questions leave it nil and use
# `body` alone. For choice-based, `body` echoes the chosen label so
# federation + the legacy Status projection still read like sentences.
class Answer < ApplicationRecord
  belongs_to :question
  belongs_to :account
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :answer

  VISIBILITY_SCOPES = %w(everyone kronk_members connections vouched only_me).freeze

  validates :body, presence: true
  validates :account_id, uniqueness: { scope: :question_id }
  validates :visibility_scope, inclusion: { in: VISIBILITY_SCOPES }
  validate  :choice_index_matches_format

  after_commit :publish_kuestions_question_answered, on: :create

  private

  # Choice-based questions need an in-range index; free-text must not
  # carry one.
  def choice_index_matches_format
    return unless question

    if question.choice_based?
      errors.add(:choice_index, 'must be an in-range option index for a choice-based Kuestion') unless choice_index.is_a?(Integer) && choice_index.between?(0, question.mc_options.size - 1)
    elsif choice_index.present?
      errors.add(:choice_index, 'must be blank for a free-text Kuestion')
    end
  end

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
