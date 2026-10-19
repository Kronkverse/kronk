# frozen_string_literal: true

module Paperclip
  module MediaTypeSpoofDetectorExtensions
    MARCEL_MIME_TYPES = %w(audio/mpeg image/avif).freeze

    # WebM and MP4 are containers for sound, pictures or both, and the
    # `file` command calls every one of them video. A voice note recorded
    # in the browser is labelled audio/webm by Paperclip, so it was refused
    # as a spoof. The same container under its audio name is not a spoof.
    AUDIO_IN_VIDEO_CONTAINER = { 'audio/webm' => 'video/webm', 'audio/mp4' => 'video/mp4' }.freeze

    def calculated_content_type
      return @calculated_content_type if defined?(@calculated_content_type)

      @calculated_content_type = type_from_file_command.chomp

      # The `file` command fails to recognize some MP3 files as such
      @calculated_content_type = type_from_marcel if @calculated_content_type == 'application/octet-stream' && type_from_marcel.in?(MARCEL_MIME_TYPES)
      @calculated_content_type = @content_type if AUDIO_IN_VIDEO_CONTAINER[@content_type] == @calculated_content_type
      @calculated_content_type
    end

    def type_from_marcel
      @type_from_marcel ||= Marcel::MimeType.for Pathname.new(@file.path),
                                                 name: @file.path
    end
  end
end

Paperclip::MediaTypeSpoofDetector.prepend(Paperclip::MediaTypeSpoofDetectorExtensions)
