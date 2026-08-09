# frozen_string_literal: true

# GET /api/v1/map/geocode?q=<query>
#
# Server-side proxy for OSM's public Nominatim geocoder. The Map's
# "search a place" control calls this to translate a typed place name
# ("Wellington, NZ", "Eiffel Tower", "Pak n Save Onehunga") into a
# lat/lng + display label, which the client then hands to
# `POST /api/v1/map/presence` to drop a pin.
#
# We proxy instead of hitting Nominatim from the browser because:
#
#   - Nominatim's usage policy requires a valid `User-Agent` per
#     request (with contact info); browsers won't let JS set that
#     header. Rails can.
#   - We want to cache identical searches (Nominatim explicitly asks
#     callers to cache) and eventually rate-limit.
#   - We shouldn't leak the user's IP address to a third party by
#     default; a server hop keeps map interactions inside Kronk.
#
# Attribution is the caller's responsibility — the Map surface renders
# "© OpenStreetMap contributors" under the results list.
#
# Cache: keyed by lowercased+trimmed query; 24-hour TTL. Nominatim
# results for a place name are stable within that window.
class Api::V1::Map::GeocodeController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }
  before_action :require_user!

  MAX_QUERY_LENGTH = 200
  MAX_RESULTS = 5
  CACHE_TTL = 24.hours
  NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
  # Contact address required by Nominatim's usage policy. Change if
  # ownership of the instance changes.
  USER_AGENT = 'Kronk/1.0 (admin@kronk.info)'

  def index
    query = params[:q].to_s.strip
    return render(json: []) if query.blank? || query.length > MAX_QUERY_LENGTH

    results = Rails.cache.fetch(cache_key(query), expires_in: CACHE_TTL) do
      fetch_from_nominatim(query)
    end

    render json: results || []
  end

  private

  def cache_key(query)
    "geocode:v1:#{Digest::SHA1.hexdigest(query.downcase)}"
  end

  def fetch_from_nominatim(query)
    conn = Faraday.new(NOMINATIM_URL) do |c|
      c.headers['User-Agent'] = USER_AGENT
      c.options.timeout = 5
      c.options.open_timeout = 3
    end

    response = conn.get('/search', {
      q: query,
      format: 'json',
      limit: MAX_RESULTS,
      addressdetails: 0,
    })

    return [] unless response.success?

    JSON.parse(response.body).filter_map do |row|
      lat = row['lat']&.to_f
      lng = row['lon']&.to_f
      label = row['display_name']
      next if lat.nil? || lng.nil? || label.blank?

      { label: label, lat: lat, lng: lng }
    end
  rescue Faraday::Error, JSON::ParserError => e
    Rails.logger.warn("Nominatim geocode failed for #{query.inspect}: #{e.class} #{e.message}")
    []
  end
end
