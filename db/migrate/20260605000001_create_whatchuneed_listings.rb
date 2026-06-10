# frozen_string_literal: true

class CreateWhatchuneedListings < ActiveRecord::Migration[8.0]
  def change
    create_table :whatchuneed_listings do |t|
      t.bigint  :account_id,  null: false
      t.string  :title,       null: false
      t.text    :body,        null: false
      t.string  :category
      t.integer :status,      null: false, default: 0

      t.timestamps
    end

    add_index :whatchuneed_listings, :account_id
    add_index :whatchuneed_listings, [:status, :created_at]
    add_foreign_key :whatchuneed_listings, :accounts, on_delete: :cascade, validate: false
  end
end
