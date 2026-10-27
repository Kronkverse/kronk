# frozen_string_literal: true

# Brands in Wachuneed (docs/spaces/wachuneed.md, Brands; Kommons
# "Reccomened brands space"): brands whose mission members have looked into
# and respect. Any member proposes one; other members back it, one backing
# each, and it joins the Brands list once enough have
# (`WachuneedBrand::BACKERS_TO_LIST`, the proposer included).
class CreateWachuneedBrands < ActiveRecord::Migration[8.1]
  def change
    create_table :wachuneed_brands do |t|
      # Who proposed it. They can edit it or take it down.
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.string :url, null: false
      # Why we back them: required, it is the point of the list.
      t.text :why, null: false
      t.string :category
      # A logo or picture, the proposer's own upload.
      t.references :media_attachment, foreign_key: { on_delete: :nullify }
      # When it first reached the backers it needs; the proposer is nudged
      # then, and only then.
      t.datetime :listed_at
      t.timestamps
    end

    # One brand per name, whatever the case, so backing isn't split between
    # two proposals of the same brand.
    add_index :wachuneed_brands, 'lower(name)', unique: true, name: 'index_wachuneed_brands_on_lower_name'

    create_table :wachuneed_brand_backings do |t|
      t.references :wachuneed_brand, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :wachuneed_brand_backings, [:wachuneed_brand_id, :account_id], unique: true, name: 'index_wachuneed_brand_backings_on_brand_and_account'
  end
end
