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
end
