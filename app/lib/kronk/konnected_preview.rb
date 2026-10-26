# frozen_string_literal: true

# What a Konnected record shows of itself on another record's page
# (decisions.md, 2026-10-26, "Konnected records show themselves"): a Place
# its map, an album its photos, an event its date. The Konnected section
# draws a card from it; a korner with nothing here stays a tile.
#
# Each entry is small and only what the card draws: the record's own page
# has the rest. It is read for records the viewer can already see (the
# attachments index only serves those), so it adds no audience check.
module Kronk
  module KonnectedPreview
    module_function

    ALBUM_PHOTOS = 4

    BUILDERS = {
      'map' => :map_place,
      'albutts' => :album,
      'kalendar' => :event,
      'booth' => :booth_set,
      'cinema' => :film,
      'karporn' => :kar,
      'wachuneed' => :listing,
      'kronikles' => :chronicle,
    }.freeze

    # The preview for `record` in korner `slug`, or nil when it has none.
    def for(slug, record)
      builder = BUILDERS[slug]
      return nil if builder.nil? || record.nil?

      send(builder, record)
    end

    def map_place(place)
      { latitude: place.latitude.to_f, longitude: place.longitude.to_f, address: place.address.presence }
    end

    def album(album)
      photos = album.photos.with_status.chronological.includes(status: :media_attachments).limit(ALBUM_PHOTOS + 1).to_a
      cover = album.cover_media_attachment&.file&.url(:small).presence
      urls = photos.filter_map { |photo| small_url(photo.status&.media_attachments&.first) }
      urls = ([cover] + urls).compact.uniq.first(ALBUM_PHOTOS)
      { photos: urls, photo_count: album.photos.with_status.count }
    end

    def event(event)
      {
        start_time: event.start_time&.iso8601,
        end_time: event.end_time&.iso8601,
        location: event.location_name.presence || Kronk::RecordPlace.for(event)&.name,
        image: small_url(event.image),
      }
    end

    def booth_set(set)
      { image: set.cover_url.presence, line: set.artist_name.presence }
    end

    def film(film)
      { image: small_url(film.video_media_attachment) }
    end

    def kar(kar)
      { image: small_url(kar.cover_media_attachment) }
    end

    def listing(listing)
      { image: small_url(listing.media_attachments.first) }
    end

    def chronicle(chronicle)
      { line: chronicle.excerpt(length: 160).presence }
    end

    def small_url(media)
      return nil if media.nil? || media.file.blank?

      media.file.url(:small).presence
    end
  end
end
