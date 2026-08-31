# frozen_string_literal: true

# Kronk Krews — the audience-scoping primitive from
# docs/spaces/krew_build_spec.md.
#
# Phase 3a of the rebuild adds the brief's data model additively:
# `seeded_by_account_id` (single seeder), `access` enum,
# `invite_token` (revocable capability), `member_count` counter,
# `last_activity_at` ordering, plus attachment (KrewKorner) + gate
# (KrewRequirement) associations. The existing `governance_framework`
# / `discoverable` / role-based multi-seeder machinery is kept for
# now so this PR doesn't have to switch modes on the controller; a
# later cleanup drops what the new shape supersedes.
class Krew < ApplicationRecord
  include Searchable

  searchable_as :krews, if: :discoverable?

  def as_json_for_search
    {
      id: id,
      name: name.to_s,
      description: description.to_s,
      discoverable: discoverable?,
      archived: respond_to?(:archived?) ? archived? : false,
      created_at: created_at&.to_i,
    }
  end

  ACCESS_LEVELS = %w(open invite_only requirement_gated).freeze
  GOVERNANCE_FRAMEWORKS = %w(peer_support two_key threshold majority consensus).freeze
  SLUG_PATTERN = /\A[a-z][a-z0-9-]*\z/

  INVITE_TOKEN_BYTES = 24

  belongs_to :seeded_by, class_name: 'Account', foreign_key: 'seeded_by_account_id', optional: true, inverse_of: false

  has_many :krew_memberships, dependent: :destroy
  has_many :members, through: :krew_memberships, source: :account
  has_and_belongs_to_many :statuses, join_table: :statuses_krews # rubocop:disable Rails/HasAndBelongsToMany

  has_many :krew_korners, dependent: :destroy
  has_many :krew_requirements, dependent: :destroy

  # Krew-scoped albums (Albutts korner). Krew deletion cascades → the
  # join rows evaporate; the album itself survives but loses this scope.
  has_many :album_krews, dependent: :destroy
  has_many :albums, through: :album_krews

  validates :slug, presence: true, uniqueness: true, format: { with: SLUG_PATTERN }
  validates :name, presence: true
  validates :access, inclusion: { in: ACCESS_LEVELS }
  validates :governance_framework, inclusion: { in: GOVERNANCE_FRAMEWORKS }
  validate  :threshold_present_when_required

  # Krew image (avatar/cover). Paperclip glue is global; mirrors the account
  # avatar. Square-cropped to 800px. Seeder-set via the update endpoint.
  KREW_IMAGE_LIMIT = 4.megabytes
  KREW_IMAGE_MIME_TYPES = %w(image/jpeg image/png image/gif image/webp).freeze

  has_attached_file :image, styles: { original: '800x800#' }, convert_options: { all: '+profile "!icc,*"' }
  validates_attachment_content_type :image, content_type: KREW_IMAGE_MIME_TYPES
  validates_attachment_size :image, less_than: KREW_IMAGE_LIMIT

  scope :active,       -> { where(archived_at: nil) }
  scope :discoverable, -> { active.where(discoverable: true) }
  scope :listed,       -> { active.where.not(access: 'invite_only') }
  scope :recent,       -> { order(last_activity_at: :desc) }

  # Brief §4: a Krew is `listed` when access != invite_only. Preserved
  # as a helper so the API + Discover query read cleanly.
  def listed?
    access != 'invite_only'
  end

  def open?
    access == 'open'
  end

  def invite_only?
    access == 'invite_only'
  end

  def requirement_gated?
    access == 'requirement_gated'
  end

  def seeders
    krew_memberships.where(role: 'seeder').includes(:account).map(&:account)
  end

  def seeder?(account)
    return true if seeded_by_account_id.present? && seeded_by_account_id == account.id

    krew_memberships.exists?(role: 'seeder', account_id: account.id)
  end

  def member?(account)
    krew_memberships.exists?(account_id: account.id)
  end

  def archived?
    archived_at.present?
  end

  # Regenerate the invite capability token. Any outstanding invite link
  # built from the previous token is invalidated by this write.
  def regenerate_invite_token!
    update!(invite_token: SecureRandom.urlsafe_base64(INVITE_TOKEN_BYTES))
  end

  # Bump last_activity_at to now — called by the same-transaction event
  # bus emitters (post to krew, member joined) so the Yours lens
  # ordering is live. Does not touch updated_at (per brief §3 — no
  # per-member "last seen" leaks).
  def touch_activity!
    update_column(:last_activity_at, Time.current)
  end

  private

  def threshold_present_when_required
    return unless governance_framework == 'threshold' && governance_threshold.to_i < 1

    errors.add(:governance_threshold, 'must be >= 1 for threshold governance')
  end
end
