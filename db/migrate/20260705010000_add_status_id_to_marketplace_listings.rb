# frozen_string_literal: true

class AddStatusIdToMarketplaceListings < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :marketplace_listings, :status, null: true, foreign_key: false, index: { algorithm: :concurrently }
    add_foreign_key :marketplace_listings, :statuses, validate: false, on_delete: :nullify
  end
end
