# frozen_string_literal: true

# Presence log for a huddle session. One row per join event; `left_at`
# is populated when the participant exits (or nil if they never did).
class HuddleParticipant < ApplicationRecord
  belongs_to :huddle_session
  belongs_to :account

  validates :joined_at, presence: true

  scope :currently_present, -> { where(left_at: nil) }

  before_validation :ensure_joined_at

  private

  def ensure_joined_at
    self.joined_at ||= Time.current
  end
end
