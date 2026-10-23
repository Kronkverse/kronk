# frozen_string_literal: true

# Queued when a musician goes live, so nudging every member doesn't hold up
# their Go live (Booth::LiveNotifier).
class Booth::LiveNotifyWorker
  include Sidekiq::Worker

  sidekiq_options retry: 3

  def perform(booth_live_id)
    booth_live = BoothLive.find_by(id: booth_live_id)
    return if booth_live.nil?

    Booth::LiveNotifier.new(booth_live).call
  end
end
