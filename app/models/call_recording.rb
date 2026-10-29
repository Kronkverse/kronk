# frozen_string_literal: true

# A recording of one of Kronk's calls: the Main Huddle, a Kuddle or a Booth
# live set (docs/spaces/huddle.md, Recordings; Tal, 2026-10-27). Jibri, the
# Jitsi server's recorder, asks for one when it has a file to upload
# (`pending`), PUTs the file to a signed URL, then says it's done (`ready`).
# Who sees it is the call's rule (Kronk::CallTarget, CallRecordingPolicy).
#
# The file is a private object (Kronk::CallRecordingStorage); destroying the
# row deletes it. Nobody can delete a recording through the app: once
# recorded, it is kept (Tal, 2026-10-29). The rows that do go are an upload
# refused for its size, and the recordings of a call record that is itself
# destroyed.
#
# `media` is `video` or `audio`. The recorder can upload both from one
# recording (a live set's audio is what becomes a set), and each row of such
# a pair points at the other (`pair`); the app shows such a pair as one
# recording, the video with its sound. A live set's audio, once ready, is
# made into a draft set for its host (Booth::LiveRecordingSetWorker).
class CallRecording < ApplicationRecord
  KINDS = Kronk::CallTarget::KINDS
  STATUSES = %w(pending ready).freeze
  MEDIA = %w(video audio).freeze
  MAX_SIZE = 4.gigabytes
  FILENAME_MAX = 200
  # The other file of a pair is uploaded straight after the first; anything
  # older is another recording.
  PAIR_WINDOW = 2.hours

  belongs_to :huddle_session, optional: true
  belongs_to :booth_live, optional: true
  belongs_to :started_by_account, class_name: 'Account', optional: true
  belongs_to :pair, class_name: 'CallRecording', optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validates :storage_key, presence: true, uniqueness: true
  validates :filename, presence: true, length: { maximum: FILENAME_MAX }
  validates :content_type, presence: true
  validates :media, inclusion: { in: MEDIA }
  validate :filename_matches_media
  validates :size, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: MAX_SIZE }
  validates :duration, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :huddle_session, presence: true, if: -> { kind == 'kuddle' }
  validates :booth_live, presence: true, if: -> { kind == 'booth_live' }

  scope :ready, -> { where(status: 'ready') }
  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

  after_destroy_commit :delete_object

  # The ready recordings of a call target, newest first.
  def self.for_target(target)
    scope = ready.where(kind: target.kind).newest_first
    case target.kind
    when 'kuddle' then scope.where(huddle_session_id: target.id)
    when 'booth_live' then scope.where(booth_live_id: target.id)
    else scope
    end
  end

  def self.build_for(target, filename:, size:, started_by: nil, media: nil)
    new(
      kind: target.kind,
      media: media || Kronk::CallRecordingStorage.media_for(filename) || 'video',
      huddle_session: target.kind == 'kuddle' ? target.record : nil,
      booth_live: target.kind == 'booth_live' ? target.record : nil,
      started_by_account: started_by,
      filename: filename,
      content_type: Kronk::CallRecordingStorage.content_type_for(filename),
      size: size,
      storage_key: Kronk::CallRecordingStorage.key_for(filename),
      status: 'pending'
    )
  end

  def target
    Kronk::CallTarget.for_recording(self)
  end

  def ready?
    status == 'ready'
  end

  def audio?
    media == 'audio'
  end

  # Links this file and the other one of the same recording: the newest
  # unpaired file of the other medium, for the same call, uploaded within
  # PAIR_WINDOW.
  def pair_with_other_file!
    other = self.class
                .where(kind: kind, huddle_session_id: huddle_session_id, booth_live_id: booth_live_id, pair_id: nil)
                .where.not(id: id)
                .where.not(media: media)
                .where(created_at: PAIR_WINDOW.ago..)
                .newest_first
                .first
    return if other.nil?

    transaction do
      update!(pair: other)
      other.update!(pair: self)
    end
  end

  # Deletes the file first, so a storage failure leaves the row (and the
  # way to try again) in place.
  def destroy_with_object!
    if Kronk::CallRecordingStorage.available?
      Kronk::CallRecordingStorage.delete(storage_key)
      @object_deleted = true
    end
    destroy!
  end

  # A live set's audio becomes a draft set once it's ready.
  def complete!(size:, duration: nil)
    update!(status: 'ready', size: size, duration: duration || self.duration, completed_at: Time.current)
    Booth::LiveRecordingSetWorker.perform_async(id) if kind == 'booth_live' && audio?
  end

  private

  def filename_matches_media
    found = Kronk::CallRecordingStorage.media_for(filename)
    errors.add(:filename, "isn't a #{media} file") if found && media.present? && found != media
  end

  # Whatever else destroys the row (a live set being deleted) takes the file
  # with it, as far as storage lets it.
  def delete_object
    return if @object_deleted || !Kronk::CallRecordingStorage.available?

    Kronk::CallRecordingStorage.delete(storage_key)
  rescue => e
    Rails.logger.warn("Call recording #{id}: could not delete #{storage_key}: #{e.class}: #{e.message}")
  end
end
