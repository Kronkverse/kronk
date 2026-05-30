# frozen_string_literal: true

module KronkClientTrackingConcern
  extend ActiveSupport::Concern

  included do
    before_action :track_kronk_client
  end

  private

  def track_kronk_client
    version = request.headers['X-Kronk-Version']
    platform = request.headers['X-Kronk-Platform']
    return if version.blank? || current_account.nil?

    Redis.current.setex(
      "kronk:client:#{current_account.id}",
      30.days.to_i,
      { version: version, platform: platform, seen_at: Time.now.utc.iso8601 }.to_json
    )
  end
end
