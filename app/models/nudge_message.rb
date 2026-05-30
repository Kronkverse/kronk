# frozen_string_literal: true

class NudgeMessage < ApplicationRecord
  belongs_to :notification
  belongs_to :media_attachment, optional: true

  MAX_WORDS = 100

  validates :body, allow_blank: true
  validate :word_count_within_limit

  private

  def word_count_within_limit
    return if body.blank?

    errors.add(:body, "exceeds #{MAX_WORDS} word limit") if body.split.size > MAX_WORDS
  end
end
