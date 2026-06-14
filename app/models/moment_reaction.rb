# frozen_string_literal: true

class MomentReaction < ApplicationRecord
  ALLOWED_EMOJI = %w(heart).freeze

  belongs_to :status
  belongs_to :account

  validates :emoji, inclusion: { in: ALLOWED_EMOJI }
  validates :account_id, uniqueness: { scope: [:status_id, :emoji] }

  scope :exists_per_emoji, lambda {
    group(:emoji).count.transform_values(&:positive?)
  }
end
