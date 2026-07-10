# frozen_string_literal: true

# Kuestions v2 dedicated model. A Question carries its own body and,
# optionally, a linked Status for feed projection. When `locked?` is
# true, Kuestions::VisibilityGate hides other-account answers from
# viewers who haven't answered themselves.
class Question < ApplicationRecord
  belongs_to :created_by_account, class_name: 'Account'
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :question
  has_many   :answers, dependent: :destroy

  validates :title, presence: true, length: { maximum: 240 }

  scope :active,   -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :locked_only, -> { where(locked: true) }

  def archived?
    archived_at.present?
  end

  def answered_by?(account)
    return false if account.nil?

    answers.exists?(account_id: account.id)
  end
end
