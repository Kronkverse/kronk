# frozen_string_literal: true

class ValidateMarketplaceStatusForeignKey < ActiveRecord::Migration[8.0]
  def change
    validate_foreign_key :marketplace_listings, :statuses
  end
end
