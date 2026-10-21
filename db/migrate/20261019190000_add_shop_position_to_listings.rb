# frozen_string_literal: true

# Where an item sits in its seller's shop, in the order they put it
# (docs/spaces/wachuneed.md, The shop builder). Null until they move things:
# an item with none comes first, newest on top, as before.
class AddShopPositionToListings < ActiveRecord::Migration[8.1]
  def change
    add_column :listings, :shop_position, :integer
  end
end
