# frozen_string_literal: true

# Map — event pins. Events with a parseable OSM `location_url` surface
# on the Map as spiral markers, filtered by the caller's visibility on
# the underlying Event (see `Event#visible_to?` and
# `Event.visible_to`). Tapping a pin opens a preview card with the
# essentials + a link to /kalendar/<slug>.
#
#   GET /api/v1/map/events — pins for upcoming events I can see
#
# Look-ahead is bounded to a rolling window so the payload stays
# small; the surface is a "what's coming" lens, not the full archive.
# Past events aren't rendered as pins by default — a historical lens
# is a separate feature.
class Api::V1::Map::EventsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }
  before_action :require_user!

  UPCOMING_WINDOW = 90.days
  MAX_PINS = 200

  def index
    events = Event.upcoming
                  .not_cancelled
                  .where(start_time: ..(Time.now.utc + UPCOMING_WINDOW))
                  .where.not(location_url: [nil, ''])
                  .visible_to(current_account)
                  .includes(:account)
                  .limit(MAX_PINS)

    pins = events.filter_map do |event|
      coords = parse_osm_url(event.location_url)
      next nil if coords.nil?

      project(event, coords)
    end

    render json: pins
  end

  private

  # Server-side counterpart to `features/events/parse_osm_url.ts`.
  # Handles the two shapes the composer's <MapPinPicker> writes:
  #   1. `?mlat=<lat>&mlon=<lng>` — query params (Nominatim result URLs).
  #   2. `#map=<zoom>/<lat>/<lng>` — hash fragment (map viewer URLs).
  # Returns `{ lat:, lng:, zoom: }` (zoom optional) or nil.
  def parse_osm_url(raw)
    uri = URI.parse(raw)
    query_pairs = uri.query.to_s.split('&').filter_map do |kv|
      k, v = kv.split('=', 2)
      [k, v] if k && v
    end
    query = query_pairs.to_h
    hash_match = uri.fragment.to_s.match(%r{map=([\d.]+)/([-\d.]+)/([-\d.]+)})
    zoom = hash_match ? hash_match[1].to_f : nil

    qlat = query['mlat']&.to_f
    qlng = query['mlon']&.to_f
    return { lat: qlat, lng: qlng, zoom: zoom } if qlat && qlng && qlat.finite? && qlng.finite?

    if hash_match
      hlat = hash_match[2].to_f
      hlng = hash_match[3].to_f
      return { lat: hlat, lng: hlng, zoom: zoom } if hlat.finite? && hlng.finite?
    end

    nil
  rescue URI::InvalidURIError, TypeError
    nil
  end

  def project(event, coords)
    {
      id: event.id.to_s,
      slug: event.slug,
      title: event.title,
      start_time: event.start_time.iso8601,
      end_time: event.end_time&.iso8601,
      location_name: event.location_name,
      event_type: event.event_type,
      lat: coords[:lat],
      lng: coords[:lng],
      zoom: coords[:zoom],
      host: {
        acct: event.account.acct,
        display_name: event.account.display_name.presence || event.account.username,
      },
      going_count: event.rsvps.where(status: :going).count,
    }
  end
end
