# frozen_string_literal: true

class ExpireMomentsWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'default', retry: 3

  BATCH_SIZE = 100

  def perform
    Status.expired_moments.includes(:replies).find_in_batches(batch_size: BATCH_SIZE) do |batch|
      batch.each do |moment|
        expire_moment!(moment)
      end
    end
  end

  private

  def expire_moment!(moment)
    # Cascade-delete replies first so RemoveStatusService has no orphaned threads
    moment.replies.find_each do |reply|
      RemoveStatusService.new.call(reply, skip_streaming: false)
    end
    RemoveStatusService.new.call(moment, skip_streaming: false)
  rescue => e
    Rails.logger.error("ExpireMomentsWorker: failed to expire moment #{moment.id}: #{e.message}")
  end
end
