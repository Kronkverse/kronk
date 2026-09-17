# frozen_string_literal: true

# Trimmed shape of a Trek for timeline embedding on the shared Status, read by
# StatusTrekCard (feed projection, docs/kronk_feed_and_reach.md §3.2). Ships
# only what the feed card renders: the activity, the headline stats, and the
# already privacy-trimmed `route` for a lightweight glimpse. The full detail
# lives at the Map API. Mirrors REST::WachuneedListingSummarySerializer et al.
#
# `route` is the stored, privacy-trimmed slice (endpoints dropped, downsampled)
# — safe to expose to anyone the parent Status is already visible to, which the
# Status's own visibility gate governs. Null when the trek has no route.
class REST::TrekSummarySerializer < ActiveModel::Serializer
  attributes :id, :activity_type, :title, :distance_m, :moving_sec,
             :pace_seconds, :speed_kmh, :elevation_gain, :recorded_at,
             :has_route, :route

  def id
    object.id.to_s
  end

  def recorded_at
    object.recorded_at.iso8601
  end
end
