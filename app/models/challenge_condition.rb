# frozen_string_literal: true

class ChallengeCondition < ApplicationRecord
  belongs_to :proposal_vote
  has_many :challenge_responses, -> { order(:created_at) }, dependent: :destroy, inverse_of: :challenge_condition

  validates :text, presence: true, length: { maximum: 500 }

  def met?
    met_at.present?
  end
end
