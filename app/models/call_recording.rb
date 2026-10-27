# frozen_string_literal: true

# A recording of one of Kronk's calls: the Main Huddle, a Kuddle or a Booth
# live set (docs/spaces/huddle.md, Recordings; Tal, 2026-10-27). Jibri, the
# Jitsi server's recorder, asks for one when it has a file to upload
# (`pending`), PUTs the file to a signed URL, then says it's done (`ready`).
# Who sees it is the call's rule (Kronk::CallTarget, CallRecordingPolicy).
#
# The file is a private object (Kronk::CallRecordingStorage); destroying the
# row deletes it.
class CallRecording < ApplicationRecord
  KINDS = Kronk::CallTarget::KINDS
  STATUSES = %w(pending ready).freeze
  MAX_SIZE = 4.gigabytes
  FILENAME_MAX = 200

  belongs_to :huddle_session, optional: true
  belongs_to :booth_live, optional: true
  belongs_to :started_by_account, class_name: 'Account', optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validates :storage_key, presence: true, uniqueness: true
  validates :filename, presence: true, length: { maximum: FILENAME_MAX }
  validates :content_type, presence: true
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

  def self.build_for(target, filename:, size:, started_by: nil)
    new(
      kind: target.kind,
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

  # Deletes the file first, so a storage failure leaves the row (and the
  # way to try again) in place.
  def destroy_with_object!
    if Kronk::CallRecordingStorage.available?
      Kronk::CallRecordingStorage.delete(storage_key)
      @object_deleted = true
    end
    destroy!
  end

  def complete!(size:, duration: nil)
    update!(status: 'ready', size: size, duration: duration || self.duration, completed_at: Time.current)
  end

  private

  # Whatever else destroys the row (a live set being deleted) takes the file
  # with it, as far as storage lets it.
  def delete_object
    return if @object_deleted || !Kronk::CallRecordingStorage.available?

    Kronk::CallRecordingStorage.delete(storage_key)
  rescue => e
    Rails.logger.warn("Call recording #{id}: could not delete #{storage_key}: #{e.class}: #{e.message}")
  end
end
