# frozen_string_literal: true

# The point in an OpenStreetMap URL, the shape a pinned location took
# before Map Places (`events.location_url`). Server-side counterpart to
# `features/events/parse_osm_url.ts`. Handles the two shapes the event
# composer's <MapPinPicker> writes:
#
#   1. `?mlat=<lat>&mlon=<lng>` (Nominatim result URLs)
#   2. `#map=<zoom>/<lat>/<lng>` (map viewer URLs)
#
# Returns `{ lat:, lng:, zoom: }` (zoom may be nil), or nil.
module Kronk
  module OsmPin
    module_function

    def parse(raw)
      uri = URI.parse(raw.to_s)
      query = uri.query.to_s.split('&').filter_map do |kv|
        k, v = kv.split('=', 2)
        [k, v] if k && v
      end.to_h
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
  end
end
