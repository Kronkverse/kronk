# frozen_string_literal: true

# A chosen answer to a wanted ad, carried through (docs/spaces/
# wachuneed.md, Answering a wanted ad): whoever does it marks it
# delivered, and the poster marks it done.
class AddDeliveredToListingOffers < ActiveRecord::Migration[8.0]
  def change
    add_column :listing_offers, :delivered_at, :datetime
    add_column :listing_offers, :completed_at, :datetime
  end
end
