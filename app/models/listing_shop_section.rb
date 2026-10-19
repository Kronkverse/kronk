# frozen_string_literal: true

# One named section of a seller's shop ("Skin Care", "Tinctures"). The
# seller makes them up; a listing sits in one or in none.
class ListingShopSection < ApplicationRecord
  belongs_to :listing_shop, inverse_of: :sections
  has_many :listings, dependent: :nullify

  validates :name, presence: true, length: { maximum: 40 }
end
