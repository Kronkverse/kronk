# frozen_string_literal: true

# Marketplace listing — the primary Marketplace resource. States move
# forward through draft → live → (reserved | closed). Closing sets
# `closed_at`; reopening a closed listing means creating a fresh row.
class Listing < ApplicationRecord
  CATEGORIES = %w(creation marketplace service).freeze
  STATES     = %w(draft live reserved closed).freeze

  belongs_to :account
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :listing
  has_many   :listing_photos, -> { order(:position) }, dependent: :destroy
  has_many   :media_attachments, through: :listing_photos
  has_many   :listing_offers, dependent: :destroy

  validates :title,    presence: true, length: { maximum: 200 }
  validates :category, inclusion: { in: CATEGORIES }
  validates :state,    inclusion: { in: STATES }
  validates :price_currency, length: { is: 3 }, allow_nil: true
  validate  :price_cents_non_negative

  scope :live,      -> { where(state: 'live') }
  scope :active,    -> { where.not(state: 'closed') }
  scope :closed,    -> { where(state: 'closed') }
  scope :by_category, ->(cat) { where(category: cat) }

  def free_or_by_arrangement?
    price_cents.nil?
  end

  def close!
    update!(state: 'closed', closed_at: Time.current)
  end

  private

  def price_cents_non_negative
    return if price_cents.nil? || price_cents >= 0

    errors.add(:price_cents, 'must not be negative')
  end
end
