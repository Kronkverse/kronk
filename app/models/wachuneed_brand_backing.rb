# frozen_string_literal: true

# One member backing one brand in Wachuneed (docs/spaces/wachuneed.md,
# Brands). One each, taken back by deleting the row.
class WachuneedBrandBacking < ApplicationRecord
  belongs_to :wachuneed_brand, inverse_of: :backings
  belongs_to :account

  validates :account_id, uniqueness: { scope: :wachuneed_brand_id }

  # The brand ids with at least the backers a brand needs to be listed.
  scope :backed_enough, lambda {
    group(:wachuneed_brand_id).having('COUNT(*) >= ?', WachuneedBrand::BACKERS_TO_LIST)
  }
end
