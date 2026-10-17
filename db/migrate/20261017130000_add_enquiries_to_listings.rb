# frozen_string_literal: true

# Who can message the poster about a listing (docs/spaces/wachuneed.md,
# Enquiries): mates | orbit | anyone. Null means the listing follows the
# seller's shop (`listing_shops.enquiries`), else Mates.
class AddEnquiriesToListings < ActiveRecord::Migration[8.0]
  def change
    add_column :listings, :enquiries, :string
  end
end
