# frozen_string_literal: true

class ChallengeResponse < ApplicationRecord
  belongs_to :challenge_condition
  belongs_to :account

  validates :body, presence: true, length: { maximum: 2000 }
end
