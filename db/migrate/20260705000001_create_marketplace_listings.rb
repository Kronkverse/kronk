# frozen_string_literal: true

class CreateMarketplaceListings < ActiveRecord::Migration[8.0]
  def change
    create_table :marketplace_listings do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string     :title,         null: false, limit: 200
      t.text       :description,   null: false, default: '', limit: 5000
      t.string     :category,      null: false, limit: 32
      t.string     :subcategory,   limit: 64
      t.string     :price_display, limit: 100
      t.decimal    :price_numeric, precision: 12, scale: 2
      t.string     :location,      limit: 200
      t.string     :status,        null: false, default: 'active', limit: 16

      t.timestamps
    end

    add_index :marketplace_listings,
              [:category, :status, :created_at],
              name: 'idx_marketplace_listings_browse',
              order: { created_at: :desc }

    add_index :marketplace_listings, [:account_id, :status]
  end
end
