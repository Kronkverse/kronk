# frozen_string_literal: true

class NudgeReaction < ApplicationRecord
  ALLOWED_EMOJI = %w(❤️ 😂 🙌 🔥 😢).freeze

  belongs_to :notification
  belongs_to :account

  validates :emoji, inclusion: { in: ALLOWED_EMOJI }
  validates :account_id, uniqueness: { scope: :notification_id }
end
