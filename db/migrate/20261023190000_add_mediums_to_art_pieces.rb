# frozen_string_literal: true

# The mediums a piece is in, picked from its artist's portfolio mediums
# (docs/spaces/art.md, Mediums): the category a portfolio's chips sort by.
class AddMediumsToArtPieces < ActiveRecord::Migration[8.0]
  def change
    add_column :art_pieces, :mediums, :string, array: true, null: false, default: []
  end
end
