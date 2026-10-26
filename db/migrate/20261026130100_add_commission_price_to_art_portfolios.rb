# frozen_string_literal: true

# What an artist's commissions start from, and a line about them
# (docs/spaces/art.md, Portfolio). All optional.
class AddCommissionPriceToArtPortfolios < ActiveRecord::Migration[8.1]
  def change
    add_column :art_portfolios, :commission_price_cents, :bigint
    add_column :art_portfolios, :commission_currency, :string, null: false, default: 'AUD'
    add_column :art_portfolios, :commission_note, :string
  end
end
