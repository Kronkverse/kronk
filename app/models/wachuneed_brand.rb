# frozen_string_literal: true

# A brand members back in Wachuneed (docs/spaces/wachuneed.md, Brands):
# one whose mission members have looked into and respect. Any member
# proposes one, other members back it, and once BACKERS_TO_LIST people back
# it (the proposer counts) it shows in the Brands list. Until then it waits
# under Proposed, where people can back it.
#
# Seen by every signed-in member, like the rest of Wachuneed's browse; there
# is no reach to pick. Not seen by anyone its proposer blocks.
class WachuneedBrand < ApplicationRecord
  # How many backers a brand needs to be listed, the proposer included.
  BACKERS_TO_LIST = 3

  # What a brand is for. Optional; a small fixed list on purpose.
  CATEGORIES = %w(clothing art food home wellbeing outdoors other).freeze

  NOT_WEB_ADDRESS = 'must be a web address starting with http:// or https://'

  # How many backers' faces a brand's page shows.
  MAX_FACES = 60

  belongs_to :account
  belongs_to :media_attachment, optional: true
  has_many :backings, class_name: 'WachuneedBrandBacking', dependent: :destroy, inverse_of: :wachuneed_brand
  has_many :backers, through: :backings, source: :account

  normalizes :name, with: ->(name) { name.to_s.squish }
  normalizes :url, with: ->(url) { url.to_s.strip }
  normalizes :why, with: ->(why) { why.to_s.strip }
  normalizes :category, with: ->(category) { category.to_s.strip.presence }

  validates :name, presence: true, length: { maximum: 80 }
  validates :name, uniqueness: { case_sensitive: false, message: 'is already in Brands' }
  validates :url, presence: true, length: { maximum: 500 }
  validates :why, presence: true, length: { maximum: 1000 }
  validates :category, inclusion: { in: CATEGORIES }, allow_nil: true
  validate :url_is_web_address

  # The proposer is its first backer.
  after_create :back_by_proposer

  # Brands with the backers they need, and those still gathering them.
  scope :listed, -> { where(id: WachuneedBrandBacking.backed_enough.select(:wachuneed_brand_id)) }
  scope :proposed, -> { where.not(id: WachuneedBrandBacking.backed_enough.select(:wachuneed_brand_id)) }

  # What `viewer` may see: everything but brands put forward by someone who
  # blocks them.
  scope :shown_to, lambda { |viewer|
    where.not(account_id: Block.where(target_account_id: viewer.id).select(:account_id))
  }

  def backers_count
    backings.loaded? ? backings.size : backings.count
  end

  def listed?
    backers_count >= BACKERS_TO_LIST
  end

  def backed_by?(viewer)
    return false if viewer.nil?

    backings.loaded? ? backings.any? { |b| b.account_id == viewer.id } : backings.exists?(account_id: viewer.id)
  end

  # `backer` backs the brand. Backing twice is one backing. The first time
  # it reaches the backers it needs, the proposer is nudged.
  def back!(backer)
    newly_listed = false

    with_lock do
      backings.find_or_create_by!(account_id: backer.id)

      if listed_at.nil? && backings.count >= BACKERS_TO_LIST
        update!(listed_at: Time.current)
        newly_listed = true
      end
    end

    backings.reset
    publish_listed(backer) if newly_listed
  end

  # `backer` takes their backing back. The proposer can't: their backing
  # is the proposal, and taking the brand down is how they withdraw it.
  def unback!(backer)
    raise Mastodon::ValidationError, 'You proposed this brand. Take it down instead.' if backer.id == account_id

    backings.where(account_id: backer.id).destroy_all
    backings.reset
  end

  private

  def back_by_proposer
    backings.create!(account: account)
  end

  # A web address someone can open: http or https, with a host.
  def url_is_web_address
    return if url.blank?

    uri = URI.parse(url)
    errors.add(:url, NOT_WEB_ADDRESS) unless uri.is_a?(URI::HTTP) && uri.host.present?
  rescue URI::InvalidURIError
    errors.add(:url, NOT_WEB_ADDRESS)
  end

  # wachuneed.brand.listed: the proposer hears their brand is on the list.
  # The actor is whoever's backing brought it there.
  def publish_listed(backer)
    Kronk::KornerEvents.publish(
      'wachuneed.brand.listed',
      actor_account_id: backer.id,
      recipient_account_id: account_id,
      brand_id: id
    )
  end
end
