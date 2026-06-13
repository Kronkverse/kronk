# frozen_string_literal: true

class ExpireStoriesWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'default', retry: 3

  BATCH_SIZE = 100

  def perform
    Status.expired_stories.includes(:replies).find_in_batches(batch_size: BATCH_SIZE) do |batch|
      batch.each do |story|
        expire_story!(story)
      end
    end
  end

  private

  def expire_story!(story)
    # Cascade-delete replies first so RemoveStatusService has no orphaned threads
    story.replies.find_each do |reply|
      RemoveStatusService.new.call(reply, skip_streaming: false)
    end
    RemoveStatusService.new.call(story, skip_streaming: false)
  rescue => e
    Rails.logger.error("ExpireStoriesWorker: failed to expire story #{story.id}: #{e.message}")
  end
end
