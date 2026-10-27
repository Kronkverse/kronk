# frozen_string_literal: true

# Where call recordings live: private objects in the app's own S3 bucket,
# under `call_recordings/<random>/<filename>` (after S3_KEY_PREFIX when one is
# set), reached only through short-lived signed URLs (docs/spaces/huddle.md,
# Recordings). Uses the bucket and credentials Paperclip is configured with
# (config/initializers/paperclip.rb), so there is no second set of keys.
#
# The recorder (Jibri) PUTs the file straight to a signed URL; Kronk never
# streams it. Objects are written without an ACL, which on S3 and DO Spaces
# means private.
module Kronk
  module CallRecordingStorage
    PREFIX         = 'call_recordings'
    UPLOAD_URL_TTL = 1.hour
    # Long enough to watch a long call without the player losing its URL
    # mid-seek; a download link needs only to start.
    PLAY_URL_TTL     = 3.hours
    DOWNLOAD_URL_TTL = 10.minutes

    # Video, and the audio-only file the recorder makes from a live set
    # (docs/spaces/huddle.md, Recordings). `.opus` is Opus in Ogg.
    VIDEO_TYPES = {
      '.mp4' => 'video/mp4',
      '.webm' => 'video/webm',
      '.mkv' => 'video/x-matroska',
    }.freeze
    AUDIO_TYPES = {
      '.m4a' => 'audio/mp4',
      '.ogg' => 'audio/ogg',
      '.opus' => 'audio/ogg',
      '.mp3' => 'audio/mpeg',
    }.freeze
    CONTENT_TYPES = VIDEO_TYPES.merge(AUDIO_TYPES).freeze

    module_function

    def available?
      Paperclip::Attachment.default_options[:storage] == :s3
    end

    def content_type_for(filename)
      CONTENT_TYPES[File.extname(filename.to_s).downcase]
    end

    # 'video' or 'audio' by the file's extension, nil for anything else.
    def media_for(filename)
      extension = File.extname(filename.to_s).downcase
      if VIDEO_TYPES.key?(extension)
        'video'
      elsif AUDIO_TYPES.key?(extension)
        'audio'
      end
    end

    def key_for(filename)
      [ENV.fetch('S3_KEY_PREFIX', nil).presence, PREFIX, SecureRandom.hex(16), filename].compact.join('/')
    end

    def upload_url(key, content_type)
      object(key).presigned_url(:put, expires_in: UPLOAD_URL_TTL.to_i, content_type: content_type)
    end

    def play_url(key, content_type)
      object(key).presigned_url(:get, expires_in: PLAY_URL_TTL.to_i, response_content_type: content_type)
    end

    def download_url(key, filename)
      disposition = ActionDispatch::Http::ContentDisposition.format(disposition: 'attachment', filename: filename)
      object(key).presigned_url(:get, expires_in: DOWNLOAD_URL_TTL.to_i, response_content_disposition: disposition)
    end

    # The stored size in bytes, or nil when nothing is there.
    def stored_size(key)
      object(key).content_length
    rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchKey
      nil
    end

    # Saves the object to a local file (Booth::LiveRecordingSet, which makes
    # a set's audio from it).
    def download(key, path)
      object(key).get(response_target: path)
      path
    end

    def delete(key)
      object(key).delete
    end

    def object(key)
      bucket.object(key)
    end

    def bucket
      require 'aws-sdk-s3'

      options = Paperclip::Attachment.default_options
      MediaAttachment.new.file.s3_interface.bucket(options[:s3_credentials][:bucket])
    end
  end
end
