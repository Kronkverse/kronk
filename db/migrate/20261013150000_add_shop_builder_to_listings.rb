# frozen_string_literal: true

# The Wachuneed shop builder (Tal 2026-10-13): what a shop's items need that
# a one-off listing does not.
#
#   listings.ongoing       an item that keeps selling, not a one-off
#   listings.availability  available / sold_out / made_to_order
#   listings.announced     whether it was posted to the feed (a shop adds
#                          items quietly unless the seller announces one)
#   listings.variants      what it comes in (size, colour) and each
#                          combination's price and availability
#   listing_photos.variant_value   the choice a photo shows ("Blue")
#   listing_shops.*        written once for the shop, shown on every item
class AddShopBuilderToListings < ActiveRecord::Migration[8.0]
  # One statement per column, where the migration checker can see each one:
  # all are plain additions, nullable or with a constant default.
  def change
    add_column :listings, :ongoing, :boolean, default: false, null: false
    add_column :listings, :availability, :string, default: 'available', null: false
    add_column :listings, :announced, :boolean, default: true, null: false
    add_column :listings, :variants, :jsonb, default: {}, null: false

    add_column :listing_photos, :variant_value, :string

    add_column :listing_shops, :payment, :text
    add_column :listing_shops, :handover, :text
    add_column :listing_shops, :based_in, :string
    add_column :listing_shops, :about, :text
  end
end
