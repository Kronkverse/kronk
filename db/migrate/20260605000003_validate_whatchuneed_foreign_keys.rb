# frozen_string_literal: true

class ValidateWhatchuneedForeignKeys < ActiveRecord::Migration[8.0]
  def change
    validate_foreign_key :whatchuneed_listings, :accounts
    validate_foreign_key :whatchuneed_responses, :whatchuneed_listings
    validate_foreign_key :whatchuneed_responses, :accounts
  end
end
