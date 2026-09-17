# frozen_string_literal: true

module User::Activity
  extend ActiveSupport::Concern

  # The home and list feeds will be stored for this amount of time, and status
  # fan-out to followers will include only people active within this time frame.
  #
  # Lowering the duration may improve performance if many people sign up, but
  # most will not check their feed every day. Raising the duration reduces the
  # amount of background processing that happens when people become active.
  ACTIVE_DURATION = ENV.fetch('USER_ACTIVE_DAYS', 7).to_i.days

  included do
    scope :signed_in_recently, -> { where(current_sign_in_at: ACTIVE_DURATION.ago..) }
    scope :not_signed_in_recently, -> { where(current_sign_in_at: ...ACTIVE_DURATION.ago) }
    # Has EVER completed a sign-in (Devise sets current_sign_in_at on the
    # first successful login). Weaker than `signed_in_recently` — used to
    # exclude accounts that confirmed their email but never actually came
    # back to use the platform. Kommunity Discover / Orb use this.
    scope :ever_signed_in, -> { where.not(current_sign_in_at: nil) }
  end

  def signed_in_recently?
    current_sign_in_at.present? && current_sign_in_at >= ACTIVE_DURATION.ago
  end

  private

  def inactive_since_duration?
    last_sign_in_at < ACTIVE_DURATION.ago
  end
end
