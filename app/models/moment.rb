# frozen_string_literal: true

# Moment — an ephemeral photo/video post with a fixed 24h expiry.
# Discovery locked in alpha.313 (see docs/spaces/moments.md +
# config/korners/moments.yaml). A Moment is a first-class row that
# projects to a Status for feed presence, mirroring the pattern used
# by Event (kalendar) and KosmicUpdate (inflow).
class Moment < ApplicationRecord
  DEFAULT_LIFETIME = 24.hours

  belongs_to :account
  belongs_to :media_attachment
  belongs_to :krew, optional: true # only present when visibility == :krew
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :moment

  has_many :moment_froths, dependent: :destroy, inverse_of: :moment

  # Full four-tier reach ladder (docs/kronk_feed_and_reach.md §2) +
  # krew as the orthogonal axis. Integer 0 was `public_reach` under
  # the pre-Reach naming; kept at 0 as `public` so existing rows
  # round-trip without a data migration.
  enum :visibility,
       { public: 0, mates: 1, krew: 2, orbit: 3, self_only: 4 },
       prefix: :visible_to

  validates :expires_at, presence: true
  validates :caption, length: { maximum: 500 }, allow_blank: true
  validate  :krew_only_when_krew_visibility

  # Convenience alias for the historical `group_id` name used in
  # cross-korner payloads and older comments. The column is `krew_id`
  # (renamed from group_id in 20260723150000).

  before_validation :set_default_expiry, on: :create

  scope :active,  -> { where('expires_at > ?', Time.current) }
  scope :expired, -> { where(expires_at: ..Time.current) }
  scope :for_account, ->(account) { where(account: account) }
  scope :recent, -> { order(created_at: :desc) }

  def active?
    expires_at.future?
  end

  def froth_count
    moment_froths.count
  end

  def frothed_by?(other_account)
    return false unless other_account

    moment_froths.exists?(account: other_account)
  end

  private

  def set_default_expiry
    self.expires_at ||= created_at.presence&.+(DEFAULT_LIFETIME) || (Time.current + DEFAULT_LIFETIME)
  end

  def krew_only_when_krew_visibility
    return if visible_to_krew? == krew_id.present?

    if visible_to_krew? && krew_id.blank?
      errors.add(:krew_id, 'must be present when visibility is krew')
    elsif !visible_to_krew? && krew_id.present?
      errors.add(:krew_id, 'must be blank unless visibility is krew')
    end
  end
end
