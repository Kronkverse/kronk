# frozen_string_literal: true

class EnsureBoothMediaPublicAclWorker
  include Sidekiq::Worker

  # Retry on StillProcessing — gives Sidekiq's exponential backoff enough total
  # time to outlast a multi-GB ffmpeg conversion before giving up.
  sidekiq_options retry: 12, queue: 'default'

  class StillProcessing < StandardError; end

  def perform(booth_set_id)
    booth_set = BoothSet.find(booth_set_id)
    ids = [booth_set.audio_attachment_id, booth_set.cover_attachment_id].compact
    return if ids.empty?

    attachments = MediaAttachment.where(id: ids)
    raise StillProcessing, "BoothSet #{booth_set_id} media still processing" if attachments.any?(&:not_processed?)

    UpdateMediaAttachmentsPermissionsService.new.call(attachments, :public)
  rescue ActiveRecord::RecordNotFound
    nil
  end
end
