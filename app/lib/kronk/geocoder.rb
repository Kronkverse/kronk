# frozen_string_literal: true

# Typed place name → points, through OSM's public Nominatim, from the
# server (docs/spaces/map.md). Used by `GET /api/v1/map/geocode` (the
# place search on the Map and in the pin picker) and by
# `POST /api/v1/map/places` when a Place is made from an address alone.
#
# Why from the server: Nominatim's usage policy wants a `User-Agent` with
# contact details on every request, which browsers can't set; identical
# searches should be cached (Nominatim asks for that); and a member's IP
# shouldn't reach a third party.
#
# Cache: keyed by the lowercased query, 24 hours. Any failure (cache,
# network, parse) gives an empty list, never an error: the search box then
# says "No matches", the least alarming way to fail.
module Kronk
  module Geocoder
    module_function

    MAX_QUERY_LENGTH = 200
    MAX_RESULTS = 5
    CACHE_TTL = 24.hours
    NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
    # Contact address required by Nominatim's usage policy. Change if
    # ownership of the instance changes.
    USER_AGENT = 'Kronk/1.0 (admin@kronk.info)'

    # Up to MAX_RESULTS `{ label:, lat:, lng: }` for `query`.
    def search(query)
      query = query.to_s.strip
      return [] if query.blank? || query.length > MAX_QUERY_LENGTH

      fetch_cached(query)
    end

    def cache_key(query)
      "geocode:v1:#{Digest::SHA1.hexdigest(query.downcase)}"
    end

    def fetch_cached(query)
      Rails.cache.fetch(cache_key(query), expires_in: CACHE_TTL) do
        fetch_from_nominatim(query)
      end
    rescue => e
      Rails.logger.warn("Geocode cache failed for #{query.inspect}: #{e.class} #{e.message}")
      fetch_from_nominatim(query)
    end

    def fetch_from_nominatim(query)
      conn = Faraday.new(NOMINATIM_URL) do |c|
        c.headers['User-Agent'] = USER_AGENT
        c.options.timeout = 5
        c.options.open_timeout = 3
      end

      response = conn.get('/search', { q: query, format: 'json', limit: MAX_RESULTS, addressdetails: 0 })
      return [] unless response.success?

      JSON.parse(response.body).filter_map do |row|
        lat = row['lat']&.to_f
        lng = row['lon']&.to_f
        label = row['display_name']
        next if lat.nil? || lng.nil? || label.blank?

        { label: label, lat: lat, lng: lng }
      end
    # StandardError, not just Faraday::Error / JSON::ParserError: adapter
    # timeouts, SocketError, IO::TimeoutError or any other transport glitch
    # still gives an empty list, not a 500.
    rescue => e
      Rails.logger.warn("Nominatim geocode failed for #{query.inspect}: #{e.class} #{e.message}")
      []
    end
  end
end
