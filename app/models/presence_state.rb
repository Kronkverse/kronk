# frozen_string_literal: true

# Map — a single account's opt-in presence pin. One row per account; the
# stored (lat, lng) is ALREADY coarsened (Kronk::GeoCoarsen) — the raw point
# never reaches this table. Pins persist until the account removes them
# (Tal 2026-08-10 — "They should remain until a user removes them");
# `expires_at` still exists as a hard-cap so an abandoned account can't
# leak forever, but the default TTL is a century, which is
# indistinguishable from "forever" from any user's perspective.
class PresenceState < ApplicationRecord
  belongs_to :account

  # Precision tiers. Both coarsen the point before storage. `exact` is
  # deliberately absent until a per-user home anchor can enforce
  # "exact never near home" (see Kronk::GeoCoarsen).
  enum :precision, { hood: 0, city: 1 }, prefix: :precision

  # Who may see this pin. `friends` means Mates (mutual follow); `kommunity`
  # is the whole local instance; `groups` is reserved (treated as unshared
  # until Krew-scoping lands); `none` is not shared.
  enum :share_scope, { none: 0, friends: 1, groups: 2, kommunity: 3 }, prefix: :scope

  validates :account_id, uniqueness: true
  validates :lat, :lng, :expires_at, presence: true

  # Effectively "forever" — a Kronk pin persists until the account
  # explicitly removes it. A short auto-expire was the previous default
  # (60 minutes), which meant pins silently vanished after an hour and
  # forced every user to keep re-placing themselves. 100 years is well
  # beyond any account's active lifetime; the column stays non-null so
  # existing indexes and the `active` scope keep working unchanged.
  DEFAULT_TTL_MINUTES = 100 * 365 * 24 * 60

  # Currently-visible pins: not expired and actually shared.
  scope :active, -> { where(expires_at: Time.current..).where.not(share_scope: share_scopes[:none]) }

  # Place (or re-place) an account on the map. Coarsens the RAW point
  # server-side and stores only the fuzzed coordinate. Idempotent per account
  # (upsert). Raises ArgumentError on an unsupported precision tier.
  def self.place!(account, raw_lat:, raw_lng:, precision:, scope:, label: nil, ttl_minutes: DEFAULT_TTL_MINUTES)
    tier = precision.to_s
    raise ArgumentError, "unsupported precision tier #{tier}" unless Kronk::GeoCoarsen.supported_tier?(tier)

    fuzzed = Kronk::GeoCoarsen.coarsen(raw_lat, raw_lng, tier, seed: account.id)
    ttl = [ttl_minutes.to_i, 1].max

    state = find_or_initialize_by(account_id: account.id)
    state.update!(
      lat: fuzzed[:lat],
      lng: fuzzed[:lng],
      precision: tier,
      share_scope: scope.to_s,
      label: label.presence,
      expires_at: ttl.minutes.from_now
    )
    state
  end

  def expired?
    expires_at.nil? || expires_at <= Time.current
  end

  # Can `viewer` see this pin? The `friends` scope is Mates-gated (mutual
  # follow) — NOT one-way following. A share of `none`, an expired pin, or the
  # owner's own pin never surface through here.
  def visible_to?(viewer)
    return false if viewer.nil? || expired? || scope_none? || account_id == viewer.id

    case share_scope
    when 'friends' then account.mate?(viewer)
    # `kommunity` was previously "anyone on this instance" — retired
    # 2026-08-10 (Tal: "only visible to mates, never Kronkverse-wide").
    # Legacy rows with that scope should not surface via visibility
    # checks any longer. Kept as an enum value only so existing rows
    # still load.
    else false # kommunity retired; groups reserved until Krew-scoping lands
    end
  end
end
