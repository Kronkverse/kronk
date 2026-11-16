# frozen_string_literal: true

# How a listing's price reads (docs/spaces/wachuneed.md, Prices): a set
# amount, up to an amount, open to offers, a quote, a trade or free, and
# what the amount is for (an hour, a day, a session...). Null is a set
# amount, or free or by arrangement with no price, as every older listing is.
class AddPriceTypeToListings < ActiveRecord::Migration[8.0]
  def change
    add_column :listings, :price_type, :string
    add_column :listings, :price_unit, :string
  end
end
