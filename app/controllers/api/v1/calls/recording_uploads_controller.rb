# frozen_string_literal: true

# The Jitsi server's recorder (Jibri) handing Kronk a recording
# (docs/spaces/huddle.md, Recordings). Server to server: no user, no OAuth
# token, only an HMAC with JITSI_RECORDING_SECRET.
#
# Every request carries
#
#   X-Kronk-Timestamp: <unix seconds>
#   X-Kronk-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>">
#
# and is refused (401) if the signature is wrong or the timestamp is more
# than five minutes off. The timestamp is signed with the body so a captured
# request can't be replayed later under a fresh one.
#
#   POST /api/v1/calls/recordings/start  { room, filename, size, media?, duration?, started_by? }
#     -> 201 { id, media, pair_id, upload_url, upload_method: "PUT", upload_headers, expires_in }
#        404 a room that isn't one of this Kronk's calls
#        413 over 4 GB · 422 a bad filename, size or media
#   PUT  <upload_url> with upload_headers, the file as the body (to storage, not Kronk)
#   POST /api/v1/calls/recordings/:id/complete  { duration? }
#     -> 200 { id, media, status: "ready", size }
#        422 nothing has been uploaded yet · 413 the upload is over 4 GB
#
# `media` is "video" (.mp4, .webm, .mkv) or "audio" (.m4a, .ogg, .opus,
# .mp3); left out, the filename's extension decides. The extension must
# match it. One recording can be uploaded as both: the script runs start,
# PUT and complete once per file, with the same room, and Kronk pairs the
# two (`pair_id` on the second start's answer). A live set's audio file,
# once complete, becomes a draft set for its host
# (Booth::LiveRecordingSetWorker); its video stays a recording.
#
# With no JITSI_RECORDING_SECRET both are 404; without S3 storage, 503.
class Api::V1::Calls::RecordingUploadsController < Api::BaseController
  SIGNATURE_HEADER = 'X-Kronk-Signature'
  TIMESTAMP_HEADER = 'X-Kronk-Timestamp'
  MAX_SKEW = 5.minutes
  FILENAME_PATTERN = /\A[A-Za-z0-9][A-Za-z0-9._-]*\z/
  FILENAME_ERROR = 'The filename must end .mp4, .webm or .mkv for video, or .m4a, .ogg, .opus or .mp3 for audio'

  skip_before_action :require_authenticated_user!, raise: false

  before_action :require_recording_set_up!
  before_action :verify_signature!
  before_action :require_storage!

  def create
    target = Kronk::CallTarget.for_room(payload['room'])
    return render json: { error: 'Unknown room' }, status: 404 if target.nil?

    media = payload['media'].presence
    return render json: { error: 'The media must be "video" or "audio"' }, status: 422 unless media.nil? || CallRecording::MEDIA.include?(media)

    filename = clean_filename(payload['filename'], media)
    return render json: { error: FILENAME_ERROR }, status: 422 if filename.nil?

    size = integer(payload['size'])
    return render json: { error: 'The size must be a number of bytes' }, status: 422 if size.nil? || size <= 0
    return render json: { error: 'Recordings can be at most 4 GB' }, status: 413 if size > CallRecording::MAX_SIZE

    recording = CallRecording.build_for(target, filename: filename, size: size, started_by: started_by, media: media)
    recording.duration = duration
    recording.save!
    recording.pair_with_other_file!

    render json: {
      id: recording.id.to_s,
      media: recording.media,
      pair_id: recording.pair_id&.to_s,
      upload_url: Kronk::CallRecordingStorage.upload_url(recording.storage_key, recording.content_type),
      upload_method: 'PUT',
      upload_headers: { 'Content-Type' => recording.content_type },
      expires_in: Kronk::CallRecordingStorage::UPLOAD_URL_TTL.to_i,
    }, status: 201
  end

  def complete
    recording = CallRecording.find(params[:id])

    unless recording.ready?
      size = Kronk::CallRecordingStorage.stored_size(recording.storage_key)
      return render json: { error: 'Nothing has been uploaded yet' }, status: 422 if size.nil?

      if size > CallRecording::MAX_SIZE
        recording.destroy_with_object!
        return render json: { error: 'Recordings can be at most 4 GB' }, status: 413
      end

      recording.complete!(size: size, duration: duration)
    end

    render json: { id: recording.id.to_s, media: recording.media, status: recording.status, size: recording.size }
  end

  private

  def require_recording_set_up!
    render json: { error: 'Recording is not set up' }, status: 404 if Kronk::Jitsi.recording_secret.blank?
  end

  def require_storage!
    render json: { error: 'Recordings need S3 storage' }, status: 503 unless Kronk::CallRecordingStorage.available?
  end

  def verify_signature!
    timestamp = request.headers[TIMESTAMP_HEADER].to_s
    signature = request.headers[SIGNATURE_HEADER].to_s
    fresh = timestamp.match?(/\A\d{1,12}\z/) && (Time.current.to_i - timestamp.to_i).abs <= MAX_SKEW.to_i
    expected = "sha256=#{OpenSSL::HMAC.hexdigest('SHA256', Kronk::Jitsi.recording_secret, "#{timestamp}.#{request.raw_post}")}"

    return if fresh && ActiveSupport::SecurityUtils.secure_compare(expected, signature)

    render json: { error: 'Bad or stale signature' }, status: 401
  end

  def payload
    @payload ||= begin
      body = request.raw_post.presence
      parsed = body ? JSON.parse(body) : {}
      raise Mastodon::InvalidParameterError, 'The body must be a JSON object' unless parsed.is_a?(Hash)

      parsed
    rescue JSON::ParserError
      raise Mastodon::InvalidParameterError, 'The body must be a JSON object'
    end
  end

  # Jibri's own file name, kept to plain characters, with one of the types
  # Kronk plays, and of the medium the script said (when it said one).
  def clean_filename(value, media)
    name = File.basename(value.to_s).strip
    return nil if name.length > CallRecording::FILENAME_MAX || !FILENAME_PATTERN.match?(name)

    found = Kronk::CallRecordingStorage.media_for(name)
    return nil if found.nil? || (media && found != media)

    name
  end

  # A whole number from JSON, given as a number or a string of digits.
  def integer(value)
    return value if value.is_a?(Integer)

    Integer(value, 10) if value.is_a?(String)
  rescue ArgumentError
    nil
  end

  def duration
    value = integer(payload['duration'])
    value if value && !value.negative?
  end

  # Optional: the Kronk account id from the moderator's pass
  # (`context.user.id`), when the recorder knows it.
  def started_by
    id = integer(payload['started_by'])
    Account.find_by(id: id) if id
  end
end
