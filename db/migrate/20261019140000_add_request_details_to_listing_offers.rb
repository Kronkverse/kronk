# frozen_string_literal: true

# A request for an item (docs/spaces/wachuneed.md, Requests): what the buyer
# chose (the kind, any extras), how many, and the total as it stood, kept as
# asked so a later edit to the listing doesn't change it.
class AddRequestDetailsToListingOffers < ActiveRecord::Migration[8.1]
  def change
    add_column :listing_offers, :quantity, :integer, default: 1, null: false
    add_column :listing_offers, :choices, :jsonb, default: {}, null: false
    add_column :listing_offers, :total_cents, :integer
    add_column :listing_offers, :price_currency, :string, limit: 3
    add_column :listing_offers, :responded_at, :datetime
  end
end
