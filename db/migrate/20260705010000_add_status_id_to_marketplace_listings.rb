# frozen_string_literal: true

class AddStatusIdToMarketplaceListings < ActiveRecord::Migration[8.0]
  def change
    add_reference :marketplace_listings, :status, foreign_key: { on_delete: :nullify }, index: true, null: true
  end
end
