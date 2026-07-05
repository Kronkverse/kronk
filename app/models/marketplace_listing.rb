# frozen_string_literal: true

# == Schema Information
#
# Table name: marketplace_listings
#
#  id             :bigint(8)        not null, primary key
#  account_id     :bigint(8)        not null
#  title          :string(200)      not null
#  description    :text             default(""), not null
#  category       :string(32)       not null
#  subcategory    :string(64)
#  price_display  :string(100)
#  price_numeric  :decimal(12, 2)
#  location       :string(200)
#  status         :string(16)       default("active"), not null
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#

class MarketplaceListing < ApplicationRecord
  CATEGORIES = %w(creation marketplace service).freeze
  STATUSES   = %w(active paused sold archived).freeze

  CATEGORY_SLUGS = {
    'creation'    => 'creations',
    'marketplace' => 'marketplace',
    'service'     => 'services',
  }.freeze

  CATEGORY_LABELS = {
    'creation'    => 'Creation',
    'marketplace' => 'Marketplace listing',
    'service'     => 'Service',
  }.freeze

  belongs_to :account
  belongs_to :shared_status, class_name: 'Status', foreign_key: :status_id, optional: true

  validates :title, presence: true, length: { maximum: 200 }
  validates :description, length: { maximum: 5_000 }
  validates :category, inclusion: { in: CATEGORIES }
  validates :status,   inclusion: { in: STATUSES }
  validates :subcategory, length: { maximum: 64 }, allow_nil: true
  validates :price_display, length: { maximum: 100 }, allow_nil: true
  validates :location, length: { maximum: 200 }, allow_nil: true

  scope :active,        -> { where(status: 'active') }
  scope :in_category,   ->(category) { where(category: category) }
  scope :recent,        -> { order(created_at: :desc) }

  def category_slug
    CATEGORY_SLUGS[category]
  end

  def category_label
    CATEGORY_LABELS[category]
  end
end
