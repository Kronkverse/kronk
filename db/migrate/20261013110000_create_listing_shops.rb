# frozen_string_literal: true

# Wachuneed shop fronts (Tal 2026-10-12, Kommons proposal "Market Layout"):
# one optional shop per seller, with sections the seller names, and each
# listing optionally placed in one of them. A shop is a view of listings the
# seller already has, not a second thing to fill.
class CreateListingShops < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    create_table :listing_shops, if_not_exists: true do |t|
      t.references :account, null: false, index: { unique: true }, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.text :description
      t.references :media_attachment, foreign_key: { on_delete: :nullify }
      # Who may message the seller about a listing: `mates` or `anyone`.
      t.string :enquiries, null: false, default: 'mates'
      t.boolean :show_on_profile, null: false, default: false
      t.timestamps
    end

    create_table :listing_shop_sections, if_not_exists: true do |t|
      t.references :listing_shop, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    # No database foreign key: removing a section clears this in the model
    # (`dependent: :nullify`), which keeps this an online change to `listings`.
    add_column :listings, :listing_shop_section_id, :bigint, if_not_exists: true
    add_index :listings, :listing_shop_section_id, algorithm: :concurrently, if_not_exists: true
  end

  def down
    remove_index :listings, :listing_shop_section_id, algorithm: :concurrently, if_exists: true
    remove_column :listings, :listing_shop_section_id, if_exists: true
    drop_table :listing_shop_sections, if_exists: true
    drop_table :listing_shops, if_exists: true
  end
end
