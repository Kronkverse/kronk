# frozen_string_literal: true

# Map — a recorded activity. Kept private (draft) until the owner publishes it
# to their Mates (docs/spaces/map.md, Phase 3). The stored `route` is always
# the privacy-trimmed slice — the raw start/end is never persisted.
class Trek < ApplicationRecord
  belongs_to :account
  belongs_to :status, optional: true

  # run/walk/hike/swim are pace activities; ride/paddle are speed activities.
  enum :activity_type, { run: 0, walk: 1, hike: 2, swim: 3, ride: 4, paddle: 5 }, prefix: :activity
  enum :state, { draft: 0, published: 1 }, prefix: :state

  PACE_TYPES = %w(run walk hike swim).freeze

  validates :title, length: { maximum: 120 }
  validates :recorded_at, presence: true

  scope :recent, -> { order(recorded_at: :desc) }
  scope :published_treks, -> { where(state: states[:published]) }

  # The Treks feed for `viewer`: their own treks (any state) plus published
  # treks by their Mates (mutual follow) — never a one-way follower's.
  scope :feed_for, lambda { |viewer|
    mate_ids = viewer.mates.select(:id)
    where(account_id: viewer.id)
      .or(published_treks.where(account_id: mate_ids))
      .recent
  }

  # Build a Trek from a raw recorded route + stats. The route is privacy-
  # trimmed (Kronk::RoutePrivacy) before storage: the endpoints (usually home)
  # are dropped, the line downsampled, and only the trimmed middle kept. The
  # FULL distance is preserved as a stat. Starts as a draft.
  def self.record!(account, activity_type:, title:, recorded_at:, points: nil, label: nil, distance_m: nil, moving_sec: 0, pace_seconds: nil, speed_kmh: nil, elevation_gain: nil)
    trimmed = Kronk::RoutePrivacy.trim(points)
    has_route = trimmed[:route].present?

    create!(
      account: account,
      activity_type: activity_type.to_s,
      state: :draft,
      title: title.to_s.strip,
      label: label.presence,
      recorded_at: recorded_at,
      distance_m: (distance_m || trimmed[:distance_m]).to_i,
      moving_sec: moving_sec.to_i,
      pace_seconds: pace_seconds&.to_i,
      speed_kmh: speed_kmh&.to_f,
      elevation_gain: elevation_gain&.to_i,
      trimmed_m: trimmed[:trimmed_m],
      has_route: has_route,
      route: trimmed[:route]
    )
  end

  def pace?
    PACE_TYPES.include?(activity_type)
  end

  # Can `viewer` see this Trek? Owner always; otherwise only when published and
  # the owner is a Mate (mutual follow).
  def visible_to?(viewer)
    return false if viewer.nil?
    return true if account_id == viewer.id

    state_published? && account.mate?(viewer)
  end
end
