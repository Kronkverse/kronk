# frozen_string_literal: true

class CreateWhatchuneedResponses < ActiveRecord::Migration[8.0]
  def change
    create_table :whatchuneed_responses do |t|
      t.bigint :listing_id, null: false
      t.bigint :account_id, null: false
      t.text   :body,       null: false

      t.timestamps
    end

    add_index :whatchuneed_responses, [:listing_id, :created_at]
    add_index :whatchuneed_responses, :account_id
    add_foreign_key :whatchuneed_responses, :whatchuneed_listings, column: :listing_id, on_delete: :cascade, validate: false
    add_foreign_key :whatchuneed_responses, :accounts, on_delete: :cascade, validate: false
  end
end
