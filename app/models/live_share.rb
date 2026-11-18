# frozen_string_literal: true

# Live location from Anthemos (docs/spaces/map.md, Live location): one
# phone's signed permission for named Mates to see exactly where it is until
# `expires_at`. Only the permission is a row. The latest point lives in Redis,
# replaced by each new one and gone when the share ends or is stopped, so
# Kronk keeps no trail of where anyone has been.
class LiveShare < ApplicationRecord
  include Redisable

  belongs_to :account
  belongs_to :anthemos_link

  LONGEST = 24.hours
  MAX_RECIPIENTS = 20
  # A point dated further from now than this is refused: a late one is stale
  # and an early one is a clock that can't be trusted.
  POINT_WINDOW = 10.minutes

  validates :expires_at, presence: true
  validate :sensible_expiry, on: :create
  validate :recipients_are_mates, on: :create

  scope :active, -> { where(expires_at: Time.current..) }
  scope :shared_with, ->(account) { active.where('? = ANY (live_shares.recipient_account_ids)', account.id) }

  def recipients
    Account.where(id: recipient_account_ids)
  end

  # The latest point, or nil before the first one arrives.
  def point
    raw = redis.get(point_key)
    raw && JSON.parse(raw, symbolize_names: true)
  end

  # Replaces the point. Raises ArgumentError for one that is out of range,
  # out of date, or older than the one already there.
  def place!(lat:, lng:, accuracy:, at:)
    raise ArgumentError, 'share has ended' unless active?
    raise ArgumentError, 'outside the world' unless lat.between?(-90, 90) && lng.between?(-180, 180)
    raise ArgumentError, 'point is out of date' unless (at - Time.current).abs <= POINT_WINDOW

    previous = point
    raise ArgumentError, 'older than the last point' if previous && previous[:at] >= at.to_i

    redis.set(point_key, { lat: lat, lng: lng, accuracy: accuracy.clamp(0, 100_000), at: at.to_i }.to_json,
              ex: [(expires_at - Time.current).ceil, 1].max)
  end

  def active?
    expires_at > Time.current
  end

  def stop!
    redis.del(point_key)
    destroy!
  end

  private

  def point_key
    "map:live:#{id}"
  end

  def sensible_expiry
    return if expires_at.nil?

    errors.add(:expires_at, :invalid) unless expires_at > Time.current && expires_at <= LONGEST.from_now + 1.minute
  end

  def recipients_are_mates
    ids = recipient_account_ids.uniq
    return errors.add(:recipient_account_ids, :blank) if ids.empty?
    return errors.add(:recipient_account_ids, :too_long) if ids.size > MAX_RECIPIENTS

    errors.add(:recipient_account_ids, :invalid) unless account.mates.where(id: ids).count == ids.size
  end
end
