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
# The lookup, its cache and its failure handling are Kronk::Geocoder, shared
# with making a Place from an address (`POST /api/v1/map/places`).
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

  def index
    render json: Kronk::Geocoder.search(params[:q])
  end
end
