# frozen_string_literal: true

require 'zip'

# A zip of an album, or of some of its photos, for the download button on
# the album page (docs/spaces/albutts.md, Downloading).
#
# Each original is copied from wherever Paperclip keeps it (local disk or
# object storage) into a temporary file and written into the zip stored, not
# compressed: photos and videos are already compressed. The zip is built on
# disk, so memory use does not grow with the album. MAX_BYTES keeps one
# request from filling the disk or holding a web thread for minutes; a
# bigger album is downloaded in parts by selecting photos.
module Albutts
  class AlbumArchive
    MAX_BYTES = 1.gigabyte

    attr_reader :album

    # `photo_ids` nil means the whole album; otherwise only those photos, and
    # only if they belong to this album.
    def initialize(album, photo_ids: nil)
      @album = album
      @photo_ids = photo_ids
    end

    def empty?
      entries.empty?
    end

    def too_large?
      bytes > MAX_BYTES
    end

    def bytes
      entries.sum { |_photo, media| media.file_file_size.to_i }
    end

    def filename
      "#{album.title.to_s.parameterize.presence || "album-#{album.id}"}.zip"
    end

    # Builds the zip and returns it as an open Tempfile, rewound. The caller
    # closes and unlinks it (Albutts::AlbumArchive::Body does both).
    def build
      zip = Tempfile.new(["album-#{album.id}-", '.zip'], binmode: true)

      Zip::OutputStream.open(zip.path) do |out|
        entries.each_with_index do |(photo, media), index|
          write_entry(out, entry_name(photo, media, index), media)
        end
      end

      zip.rewind
      zip
    rescue
      zip&.close!
      raise
    end

    # A rack body that hands the zip over in pieces and removes it when the
    # response is finished, however it ends.
    class Body
      CHUNK = 64.kilobytes

      def initialize(file)
        @file = file
      end

      def each
        while (chunk = @file.read(CHUNK))
          yield chunk
        end
      end

      def close
        @file.close!
      end
    end

    private

    # [photo, media] pairs in album order, for photos that have a file.
    def entries
      @entries ||= photos.filter_map do |photo|
        media = photo.status&.media_attachments&.first
        [photo, media] if media&.file.present?
      end
    end

    def photos
      scope = album.photos.with_status.chronological.includes(:contributor, status: :media_attachments)
      scope = scope.where(id: @photo_ids) unless @photo_ids.nil?
      scope
    end

    # '003-ana.jpg': the place in the album, then who added it.
    def entry_name(photo, media, index)
      extension = File.extname(media.file_file_name.to_s).downcase.presence || '.jpg'
      format('%<n>03d-%<who>s%<ext>s', n: index + 1, who: photo.contributor.username, ext: extension)
    end

    # A photo whose file cannot be read is left out, so one lost file does
    # not cost the person the rest of the album.
    def write_entry(out, name, media)
      Tempfile.create(['album-photo-', File.extname(name)], binmode: true) do |source|
        media.file.copy_to_local_file(:original, source.path)
        out.put_next_entry(name, '', Zip::ExtraField.new, Zip::Entry::STORED)
        File.open(source.path, 'rb') { |file| IO.copy_stream(file, out) }
      end
    rescue => e
      Rails.logger.warn("[albutts] left media #{media.id} out of the album #{album.id} download: #{e.class} #{e.message}")
    end
  end
end
