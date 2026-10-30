# frozen_string_literal: true

# How a listing is booked (docs/spaces/wachuneed.md, Booking): the parts
# the seller chose and when they are free. Empty means it is had the usual
# way, by asking for it.
class AddBookingToListings < ActiveRecord::Migration[8.0]
  def change
    add_column :listings, :booking, :jsonb, default: {}, null: false
  end
end
