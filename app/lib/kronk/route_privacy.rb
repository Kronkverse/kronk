# frozen_string_literal: true

module Kronk
  # Map — Trek route privacy. A recorded route usually starts and ends at
  # home, so the raw endpoints are the single most sensitive part of a Trek.
  # Before any geometry is stored, this trims a radius off BOTH ends (so the
  # published route begins/ends away from the true start/end) and downsamples
  # the line. The full distance is preserved as a stat; only the trimmed middle
  # is ever persisted.
  #
  # Points are [lng, lat] pairs (GeoJSON order), matching the Trek `route`
  # column and the Map prototype.
  module RoutePrivacy
    TRIM_RADIUS_M = 250 # hide the true start/end (home)
    MAX_POINTS = 500    # cap stored geometry size

    module_function

    # Returns { route:, distance_m:, trimmed_m: }. `route` is the trimmed,
    # downsampled slice (nil if trimming leaves nothing); `distance_m` is the
    # FULL route length; `trimmed_m` is how much geometry was removed.
    def trim(points)
      pts = Array(points).select { |p| p.is_a?(Array) && p.size >= 2 }
      return { route: nil, distance_m: 0, trimmed_m: 0 } if pts.size < 2

      full = length(pts)

      first = pts.first
      start_idx = 0
      start_idx += 1 while start_idx < pts.size && near?(pts[start_idx], first)

      last = pts.last
      end_idx = pts.size - 1
      end_idx -= 1 while end_idx >= 0 && near?(pts[end_idx], last)

      slice = start_idx <= end_idx ? pts[start_idx..end_idx] : []
      published = downsample(slice, MAX_POINTS)

      {
        route: published.presence,
        distance_m: full.round,
        trimmed_m: (full - length(published)).round.clamp(0, full.round),
      }
    end

    # Total polyline length in metres.
    def length(points)
      pts = Array(points)
      return 0.0 if pts.size < 2

      pts.each_cons(2).sum do |(alng, alat), (blng, blat)|
        Kronk::GeoCoarsen.distance_m(alat, alng, blat, blng)
      end
    end

    def near?(point, anchor)
      Kronk::GeoCoarsen.distance_m(point[1], point[0], anchor[1], anchor[0]) < TRIM_RADIUS_M
    end

    # Evenly thin a point list down to at most `max` points, always keeping
    # the first and last.
    def downsample(points, max)
      pts = Array(points)
      return pts if pts.size <= max || max < 2

      step = (pts.size - 1).fdiv(max - 1)
      (0...max).map { |i| pts[(i * step).round] }
    end
  end
end
