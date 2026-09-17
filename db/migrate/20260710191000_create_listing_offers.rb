# frozen_string_literal: true

# Offers made against a listing. Buyer sends a message + optional
# counter-amount; seller accepts, declines, or times out.
class CreateListingOffers < ActiveRecord::Migration[8.0]
  def change
    create_table :listing_offers do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }
      t.references :offerer, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.text       :message
      t.integer    :amount_cents # nil = accept listed price
      t.string     :state, default: 'pending', null: false # pending | accepted | declined | withdrawn | expired

      t.timestamps
    end

    add_index :listing_offers, [:listing_id, :state]
    add_index :listing_offers, [:listing_id, :offerer_id]
  end
end
