# frozen_string_literal: true

# Moment — an ephemeral photo/video post with a fixed 24h expiry.
# Discovery locked in alpha.313 (see docs/spaces/moments.md +
# config/korners/moments.yaml). A Moment is a first-class row that
# projects to a Status for feed presence, mirroring the pattern used
# by Event (kalendar) and KosmicUpdate (inflow).
class Moment < ApplicationRecord
  DEFAULT_LIFETIME = 24.hours

  belongs_to :account
  # Optional since voice-only Moments (2026-08-09) — a Moment may be a
  # bare voice clip with no photo/video. `media_present_or_voice`
  # keeps it from being wholly empty.
  belongs_to :media_attachment, optional: true
  # Companion voice clip. On a photo Moment it's the paired note; on a
  # voice-only Moment it's the whole content (docs/spaces/moments.md,
  # added 2026-08-04, voice-only 2026-08-09). Never pairs with a video.
  belongs_to :voice_media_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :krew, optional: true # orthogonal audience add-on (additive to reach)
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :moment

  has_many :moment_froths, dependent: :destroy, inverse_of: :moment

  # Reach ladder (docs/kronk_feed_and_reach.md §2). Krew is an ORTHOGONAL
  # axis — a separate `krew_id` whose members see the Moment in ADDITION to
  # the reach tier — so it is deliberately not a rung here (krew:2 retired
  # 2026-08-10 and remapped to self_only; the gap at 2 is intentional).
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       prefix: :visible_to

  validates :expires_at, presence: true
  validates :caption, length: { maximum: 500 }, allow_blank: true
  validate  :media_present_or_voice
  validate  :voice_only_paired_with_a_still
  validate  :text_overlays_have_valid_shape

  # Bound on how many overlays a single Moment can carry. Signal caps
  # at ~5–10 layers; this is defensive against runaway JSON that would
  # blow up the read path. Docs live alongside the shape in the
  # migration comment.
  MAX_TEXT_OVERLAYS = 12
  TEXT_OVERLAY_BACKINGS = %w(none dark light accent).freeze
  TEXT_OVERLAY_FONTS = %w(display body mono).freeze
  TEXT_OVERLAY_MAX_TEXT = 200
  TEXT_OVERLAY_NUMERIC_KEYS = %w(x y width size).freeze

  # Convenience alias for the historical `group_id` name used in
  # cross-korner payloads and older comments. The column is `krew_id`
  # (renamed from group_id in 20260723150000).

  before_validation :set_default_expiry, on: :create

  scope :active,  -> { where('expires_at > ?', Time.current) }
  scope :expired, -> { where(expires_at: ..Time.current) }
  scope :for_account, ->(account) { where(account: account) }
  scope :recent, -> { order(created_at: :desc) }

  # Moments visible to `viewer`, per the reach ladder (public → everyone;
  # mates → owner's mutuals; orbit → mates-of-mates; self_only → owner only)
  # PLUS the orthogonal krew axis: any Moment targeting a krew the viewer is
  # in is visible regardless of its reach tier (docs/kronk_feed_and_reach.md
  # §2). The owner always sees their own. Compose with .active / .expired.
  scope :visible_to, lambda { |viewer|
    return visible_to_public if viewer.nil?

    mate_ids       = viewer.mates.select(:id)
    krew_ids       = viewer.krews.select(:id)
    mates_of_mates = Account.where(id: Follow.where(account_id: mate_ids).select(:target_account_id))
                            .where(id: Follow.where(target_account_id: mate_ids).select(:account_id))
                            .where.not(id: viewer.id)
                            .select(:id)

    where(account_id: viewer.id)
      .or(visible_to_public)
      .or(visible_to_mates.where(account_id: mate_ids))
      .or(visible_to_orbit.where(account_id: mates_of_mates))
      .or(where(krew_id: krew_ids))
  }

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

  # Single-record counterpart to the `visible_to` scope — used to gate
  # #show so a hidden Moment can't be fetched directly by id.
  def visible_to?(viewer)
    return true if viewer && viewer.id == account_id
    # Krew is additive — a member sees it whatever the reach tier is.
    return true if krew_visible_to?(viewer)
    return true if visible_to_public?
    return mates_visible_to?(viewer) if visible_to_mates?
    return orbit_visible_to?(viewer) if visible_to_orbit?

    false # self_only — owner-only, already handled above
  end

  private

  # A Moment must carry something: a photo/video, a voice clip, or both.
  # Guards the relaxed media_attachment_id NOT NULL (voice-only Moments,
  # 2026-08-09) against a wholly empty row.
  def media_present_or_voice
    return if media_attachment_id.present? || voice_media_attachment_id.present?

    errors.add(:base, 'must have a photo, video, or voice clip')
  end

  def mates_visible_to?(viewer)
    return false if viewer.nil?

    viewer.mates.exists?(id: account_id)
  end

  def orbit_visible_to?(viewer)
    return false if viewer.nil?
    return true  if viewer.mates.exists?(id: account_id) # mates see orbit too

    viewer.orbit_of?(account)
  end

  def krew_visible_to?(viewer)
    return false if viewer.nil? || krew_id.nil?

    viewer.krews.exists?(id: krew_id)
  end

  def set_default_expiry
    self.expires_at ||= created_at.presence&.+(DEFAULT_LIFETIME) || (Time.current + DEFAULT_LIFETIME)
  end

  # Voice clip is only meaningful over a still photo. Video already
  # carries its own audio track, so we reject the combination rather
  # than silently muxing them (docs/spaces/moments.md § What a Moment
  # is — voice does not pair with video).
  def voice_only_paired_with_a_still
    return if voice_media_attachment_id.blank?
    return unless media_attachment&.video? || media_attachment&.gifv?

    errors.add(:voice_media_attachment_id, 'may only pair with a still photo, not a video')
  end

  # Structural check on the `text_overlays` JSONB — each entry must
  # be a hash with the right keys + correct value types + values in
  # range. The composer builds well-formed overlays, so this catches
  # API misuse rather than user typos.
  def text_overlays_have_valid_shape
    return if text_overlays.blank?

    unless text_overlays.is_a?(Array)
      errors.add(:text_overlays, 'must be an array')
      return
    end

    if text_overlays.size > MAX_TEXT_OVERLAYS
      errors.add(:text_overlays, "may have at most #{MAX_TEXT_OVERLAYS} entries")
      return
    end

    text_overlays.each_with_index do |ov, i|
      unless ov.is_a?(Hash)
        errors.add(:text_overlays, "entry #{i} is not an object")
        next
      end

      text = ov['text'] || ov[:text]
      errors.add(:text_overlays, "entry #{i} has invalid text") unless text.is_a?(String) && !text.empty? && text.length <= TEXT_OVERLAY_MAX_TEXT

      TEXT_OVERLAY_NUMERIC_KEYS.each do |key|
        v = ov[key] || ov[key.to_sym]
        errors.add(:text_overlays, "entry #{i} #{key} must be 0..1") unless v.is_a?(Numeric) && v >= 0 && v <= 1
      end

      rot = ov['rotation'] || ov[:rotation] || 0
      errors.add(:text_overlays, "entry #{i} rotation must be numeric") unless rot.is_a?(Numeric)

      color = ov['color'] || ov[:color]
      errors.add(:text_overlays, "entry #{i} color must be a #hex string") unless color.is_a?(String) && color.match?(/\A#[0-9a-fA-F]{3,8}\z/)

      backing = ov['backing'] || ov[:backing]
      errors.add(:text_overlays, "entry #{i} backing must be one of #{TEXT_OVERLAY_BACKINGS.join('/')}") unless TEXT_OVERLAY_BACKINGS.include?(backing)

      font = ov['font'] || ov[:font]
      errors.add(:text_overlays, "entry #{i} font must be one of #{TEXT_OVERLAY_FONTS.join('/')}") unless TEXT_OVERLAY_FONTS.include?(font)
    end
  end
end
