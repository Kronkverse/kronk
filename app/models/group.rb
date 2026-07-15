# frozen_string_literal: true

# Kronk Groups — a framework-level primitive. Seeders (not owners)
# planted the group; multiple seeders permitted from creation. Structural
# changes route through the governance framework the seeders chose:
#
#   peer_support  (default) — one second required to enact
#   two_key                 — two seconds required
#   threshold               — governance_threshold members must support
#   majority                — >50% of members must support
#   consensus               — unanimous
#
# See docs/kronk_korner_spec.md §Groups.
class Group < ApplicationRecord
  GOVERNANCE_FRAMEWORKS = %w(peer_support two_key threshold majority consensus).freeze
  SLUG_PATTERN = /\A[a-z][a-z0-9-]*\z/

  has_many :group_memberships, dependent: :destroy
  has_many :members, through: :group_memberships, source: :account
  has_and_belongs_to_many :statuses, join_table: :statuses_groups # rubocop:disable Rails/HasAndBelongsToMany

  validates :slug, presence: true, uniqueness: true, format: { with: SLUG_PATTERN }
  validates :name, presence: true
  validates :governance_framework, inclusion: { in: GOVERNANCE_FRAMEWORKS }
  validate  :threshold_present_when_required

  scope :active,       -> { where(archived_at: nil) }
  scope :discoverable, -> { active.where(discoverable: true) }

  def seeders
    group_memberships.where(role: 'seeder').includes(:account).map(&:account)
  end

  def seeder?(account)
    group_memberships.exists?(role: 'seeder', account_id: account.id)
  end

  def member?(account)
    group_memberships.exists?(account_id: account.id)
  end

  def archived?
    archived_at.present?
  end

  private

  def threshold_present_when_required
    return unless governance_framework == 'threshold' && governance_threshold.to_i < 1

    errors.add(:governance_threshold, 'must be >= 1 for threshold governance')
  end
end
