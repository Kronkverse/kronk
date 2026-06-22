# frozen_string_literal: true

class BoothSet < ApplicationRecord
  belongs_to :account
  belongs_to :event, optional: true
  belongs_to :audio_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :cover_attachment, class_name: 'MediaAttachment', optional: true

  validates :title, presence: true, length: { maximum: 200 }
  validates :artist_name, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 5000 }
  validates :event_name, length: { maximum: 200 }
  validates :genres, length: { maximum: 10 }

  scope :published, -> { where(published: true) }
  scope :recent, -> { order(created_at: :desc) }

  after_save :ensure_attachments_public, if: :saved_change_to_attachment_ids?

  def audio_url
    audio_attachment&.file&.url(:original)
  end

  def cover_url
    cover_attachment&.file&.url(:small)
  end

  def increment_play_count!
    increment!(:play_count)
  end

  private

  def saved_change_to_attachment_ids?
    saved_change_to_audio_attachment_id? || saved_change_to_cover_attachment_id?
  end

  # Audio is reprocessed async by PostProcessMediaWorker, which can leave the
  # re-uploaded file with a non-public ACL on S3. Defer to a worker that waits
  # for processing to complete, then re-applies public-read.
  def ensure_attachments_public
    EnsureBoothMediaPublicAclWorker.perform_async(id)
  end
end
