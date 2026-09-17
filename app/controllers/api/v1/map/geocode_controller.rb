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
  # Accept the same scope pair as PresenceController — the SPA's Web-app
  # token grants top-level `:read`, but korner-scoped tokens (e.g. Map's
  # own manifest declares `read:accounts`) only carry `:read:accounts`.
  # Requiring `:read` exclusively 401'd those tokens even though the
  # user had every right to search a place name; broadening the scope
  # list matches PresenceController and stops the client showing
  # "Couldn't reach the geocoder — try again." for what is really an
  # auth-shape mismatch.
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
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

    results = fetch_cached(query)
    render json: results
  end

  private

  def cache_key(query)
    "geocode:v1:#{Digest::SHA1.hexdigest(query.downcase)}"
  end

  # A wide rescue on the cache lookup: if Redis / the backing store is
  # having a moment, we still want to return results (bypassing the
  # cache), never 500 — a 500 flips the client to the "couldn't reach
  # the geocoder" error state, which reads as an OSM outage the user
  # can't do anything about.
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
  # StandardError, not just Faraday::Error / JSON::ParserError: adapter
  # timeouts, SocketError, IO::TimeoutError (Ruby 3.4), or any other
  # transport glitch should still return an empty result set, not blow
  # up into a 500. The client shows "No matches — try a different
  # name.", which is the least alarming failure mode.
  rescue => e
    Rails.logger.warn("Nominatim geocode failed for #{query.inspect}: #{e.class} #{e.message}")
    []
  end
end
