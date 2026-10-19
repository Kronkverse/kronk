# frozen_string_literal: true

# Who can see a Wachuneed listing or shop, on the reach ladder (public 0,
# mates 1, orbit 3, self_only 4, as ArtPiece). Whoever can see one can
# message about it, which retires the `enquiries` columns (dropped later).
# Everything is public today, so every row starts there.
class AddVisibilityToListingsAndShops < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_column :listings, :visibility, :integer, default: 0, null: false
    add_column :listing_shops, :visibility, :integer, default: 0, null: false
    add_index :listings, :visibility, algorithm: :concurrently
    add_index :listing_shops, :visibility, algorithm: :concurrently
  end
end
