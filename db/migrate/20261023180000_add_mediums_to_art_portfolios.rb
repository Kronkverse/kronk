# frozen_string_literal: true

# The mediums an artist works in, shown as chips on their portfolio
# (docs/spaces/art.md, Portfolio).
class AddMediumsToArtPortfolios < ActiveRecord::Migration[8.0]
  def change
    add_column :art_portfolios, :mediums, :string, array: true, null: false, default: []
  end
end
