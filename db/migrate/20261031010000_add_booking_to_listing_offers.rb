# frozen_string_literal: true

# A request for a listing that is booked (docs/spaces/wachuneed.md,
# Booking): when, a from and a to on the Map, and what they need, as the
# listing's parts ask; and who called it off, once accepted, and when.
class AddBookingToListingOffers < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :listing_offers, :starts_at, :datetime
    add_column :listing_offers, :ends_at, :datetime
    add_column :listing_offers, :route, :jsonb, default: {}, null: false
    add_column :listing_offers, :details, :text
    add_column :listing_offers, :cancelled_at, :datetime
    add_column :listing_offers, :cancelled_by_id, :bigint
    # The times a listing is already held for.
    add_index :listing_offers, [:listing_id, :starts_at],
              where: "starts_at IS NOT NULL AND state IN ('pending', 'accepted')",
              algorithm: :concurrently
  end
end
