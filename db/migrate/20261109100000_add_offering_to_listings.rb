# frozen_string_literal: true

# What a listing offers, as chosen first in the composer (Tal, 2026-11-09,
# docs/spaces/wachuneed.md, What are you offering?): product, appointment,
# service, trip or tickets. Null is a product, which every older listing is.
class AddOfferingToListings < ActiveRecord::Migration[8.1]
  def change
    add_column :listings, :offering, :string
  end
end
