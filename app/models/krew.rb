# frozen_string_literal: true

# Kronk Krews — a framework-level primitive. Seeders (not owners)
# planted the krew; multiple seeders permitted from creation. Structural
# changes route through the governance framework the seeders chose:
#
#   peer_support  (default) — one second required to enact
#   two_key                 — two seconds required
#   threshold               — governance_threshold members must support
#   majority                — >50% of members must support
#   consensus               — unanimous
#
# The brief in docs/spaces/krew_build_spec.md redefines Krews as a
# single-seeder, no-governance, no-feed audience-scoping primitive —
# Phase 3 of the rebuild is where those field-level changes land.
# Phase 2 (this class) is the mechanical rename; behaviour is
# unchanged from the pre-rename Group class.
#
# See docs/kronk_korner_spec.md §Krews.
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

  GOVERNANCE_FRAMEWORKS = %w(peer_support two_key threshold majority consensus).freeze
  SLUG_PATTERN = /\A[a-z][a-z0-9-]*\z/

  has_many :krew_memberships, dependent: :destroy
  has_many :members, through: :krew_memberships, source: :account
  has_and_belongs_to_many :statuses, join_table: :statuses_krews # rubocop:disable Rails/HasAndBelongsToMany

  validates :slug, presence: true, uniqueness: true, format: { with: SLUG_PATTERN }
  validates :name, presence: true
  validates :governance_framework, inclusion: { in: GOVERNANCE_FRAMEWORKS }
  validate  :threshold_present_when_required

  scope :active,       -> { where(archived_at: nil) }
  scope :discoverable, -> { active.where(discoverable: true) }

  def seeders
    krew_memberships.where(role: 'seeder').includes(:account).map(&:account)
  end

  def seeder?(account)
    krew_memberships.exists?(role: 'seeder', account_id: account.id)
  end

  def member?(account)
    krew_memberships.exists?(account_id: account.id)
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
