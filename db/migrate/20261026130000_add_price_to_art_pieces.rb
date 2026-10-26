# frozen_string_literal: true

# What an artist asks for a piece that's for sale, in whole cents of its
# currency (docs/spaces/art.md, Piece details). Blank: ask about it.
class AddPriceToArtPieces < ActiveRecord::Migration[8.1]
  def change
    add_column :art_pieces, :price_cents, :bigint
    add_column :art_pieces, :price_currency, :string, null: false, default: 'AUD'
  end
end
