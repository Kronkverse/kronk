# frozen_string_literal: true

module Kronk
  # Server-side location coarsening for Map presence. This is the security
  # spine of the Map korner: a raw coordinate is fuzzed HERE, before it is
  # ever stored, and only the fuzzed result is persisted (the prototype's
  # invariant — "the real point is never stored").
  #
  # Two tiers mirror the Map prototype (public/map-preview.html): round the
  # point to a coarse grid, then add deterministic, seeded jitter so a pin is
  # stable across reads but unlinkable to the exact spot. `radius` is the fuzz
  # circle the client draws so viewers see honesty about the imprecision.
  #
  # The `exact` tier from the prototype is intentionally NOT offered until a
  # per-user home anchor exists to enforce "exact never near home".
  module GeoCoarsen
    TIERS = {
      'hood' => { round: 3, jit: 0.004, radius: 600 },   # ~hundreds of metres
      'city' => { round: 1, jit: 0.03,  radius: 6000 },  # city-scale
    }.freeze

    module_function

    # Coarsen a raw (lat, lng) to `tier`. Deterministic per (seed, tier) so a
    # mate's pin doesn't wander between polls. Returns only the fuzzed point.
    def coarsen(lat, lng, tier, seed:)
      t = TIERS.fetch(tier.to_s) { raise ArgumentError, "unsupported precision tier #{tier}" }
      f = 10.0**t[:round]
      grid_lat = (lat.to_f * f).round / f
      grid_lng = (lng.to_f * f).round / f

      {
        lat: (grid_lat + (jitter(grid_lat, grid_lng, seed, 0) * t[:jit])).round(6),
        lng: (grid_lng + (jitter(grid_lat, grid_lng, seed, 1) * t[:jit])).round(6),
      }
    end

    # The visible fuzz radius (metres) for a tier — drawn on the map so the
    # imprecision is honest, not hidden.
    def radius_for(tier)
      TIERS.fetch(tier.to_s) { raise ArgumentError, "unsupported precision tier #{tier}" }[:radius]
    end

    def supported_tier?(tier)
      TIERS.key?(tier.to_s)
    end

    # Haversine distance in metres (used by Trek privacy-trim in a later PR).
    def distance_m(lat1, lng1, lat2, lng2)
      radius = 6_371_000.0
      d_lat = to_rad(lat2 - lat1)
      d_lng = to_rad(lng2 - lng1)
      a = (Math.sin(d_lat / 2)**2) +
          (Math.cos(to_rad(lat1)) * Math.cos(to_rad(lat2)) * (Math.sin(d_lng / 2)**2))
      2 * radius * Math.asin(Math.sqrt(a))
    end

    # Deterministic pseudo-random value in [-1, 1] from the rounded point +
    # seed + salt. Stable, but reveals nothing about the sub-grid position.
    def jitter(lat, lng, seed, salt)
      x = Math.sin((lat * 12.9898) + (lng * 78.233) + (seed * 43.7) + (salt * 3.17)) * 43_758.5453
      ((x - x.floor) * 2) - 1
    end

    def to_rad(degrees)
      degrees * Math::PI / 180.0
    end
  end
end
