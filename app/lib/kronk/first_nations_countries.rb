# frozen_string_literal: true

module Kronk
  # Which First Nations Country a point is on (docs/spaces/map.md, First
  # Nations Country), from the same shapes the map draws
  # (app/javascript/images/first-nations-countries.geojson). Places, Events,
  # Treks and Mates' pins say the Country they're on, worked out here from
  # where they are, so nobody has to type it.
  #
  # The shapes are approximate, as the map says, so near a border this can
  # give the neighbour. A point off the shapes (the sea, overseas) has none.
  module FirstNationsCountries
    SOURCE = Rails.root.join('app', 'javascript', 'images', 'first-nations-countries.geojson')
    # A route is checked every few hundred metres at most, not at every point.
    ROUTE_SAMPLES = 120

    Shape = Struct.new(:id, :name, :bbox, :polygons)

    module_function

    # { id:, name: } for the shape (lat, lng) is on, or nil. A shape with no
    # name yet still gives its id, with a nil name.
    def at(lat, lng)
      lat = Float(lat, exception: false)
      lng = Float(lng, exception: false)
      return if lat.nil? || lng.nil?

      shape = shapes.find { |s| inside_bbox?(s.bbox, lng, lat) && s.polygons.any? { |rings| inside_polygon?(rings, lng, lat) } }
      shape ||= nearest(lng, lat)
      shape && { id: shape.id, name: shape.name.presence }
    end

    # The traced coastline is rough, so a coastal town (Sydney, Darwin) can sit
    # just off every shape: it takes the Country whose edge is nearest, within
    # about 15 km. Further out (the sea) there is none.
    COAST_REACH = 0.15 # degrees

    def nearest(lng, lat)
      near = shapes.select { |s| inside_bbox?(s.bbox, lng, lat, pad: COAST_REACH) }
      best = near.min_by { |s| edge_distance(s, lng, lat) }
      best if best && edge_distance(best, lng, lat) <= COAST_REACH
    end

    # Degrees to the nearest corner of a shape's outline, longitude scaled for
    # latitude. Corners are close together on the traced shapes, so this is
    # near enough for a few kilometres.
    def edge_distance(shape, lng, lat)
      scale = Math.cos(lat * Math::PI / 180)
      shape.polygons.flat_map(&:first).map { |(x, y)| Math.hypot((x - lng) * scale, y - lat) }.min
    end

    # The named Countries a route passes through, in the order it meets them.
    # `points` are [lng, lat] pairs (a Trek's route).
    def along(points)
      pts = Array(points).select { |p| p.is_a?(Array) && p.size >= 2 }
      step = [(pts.size / ROUTE_SAMPLES.to_f).ceil, 1].max
      found = (0...pts.size).step(step).filter_map { |i| at(pts[i][1], pts[i][0]) }
      found << at(pts.last[1], pts.last[0]) if pts.any?
      found.compact.select { |c| c[:name] }.uniq { |c| c[:id] }
    end

    def shapes
      @shapes ||= JSON.parse(File.read(SOURCE))['features'].map do |feature|
        props = feature['properties']
        geometry = feature['geometry']
        polygons = geometry['type'] == 'MultiPolygon' ? geometry['coordinates'] : [geometry['coordinates']]
        Shape.new(props['id'], props['name'], props['bbox'], polygons)
      end
    end

    def inside_bbox?(bbox, lng, lat, pad: 0)
      west, south, east, north = bbox
      lng.between?(west - pad, east + pad) && lat.between?(south - pad, north + pad)
    end

    # Inside the outer ring and not in a hole.
    def inside_polygon?(rings, lng, lat)
      outer, *holes = rings
      inside_ring?(outer, lng, lat) && holes.none? { |hole| inside_ring?(hole, lng, lat) }
    end

    # Ray casting: a point is inside when a line from it crosses the ring an
    # odd number of times.
    def inside_ring?(ring, lng, lat)
      inside = false
      ring.each_cons(2) do |(x1, y1), (x2, y2)|
        next unless (y1 > lat) != (y2 > lat)

        inside = !inside if lng < ((x2 - x1) * (lat - y1) / (y2 - y1)) + x1
      end
      inside
    end
  end
end
