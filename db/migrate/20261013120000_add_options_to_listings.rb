# frozen_string_literal: true

# Options on a Wachuneed listing (Tal 2026-10-12, Kommons proposal
# "Functionality for Ordering Services"): the seller's own groups of
# choices, each choice able to add to the price. Kept on the listing as
# JSON, shaped and bounded by `Listing#options=`: they are read and written
# whole with the listing and never queried on their own.
class AddOptionsToListings < ActiveRecord::Migration[8.0]
  def change
    add_column :listings, :options, :jsonb, default: [], null: false
  end
end
