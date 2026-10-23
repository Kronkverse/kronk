# frozen_string_literal: true

# What a piece is made of and how big it is, when it was made, its edition,
# and whether it can be had (docs/spaces/art.md, Piece details).
class AddDetailsToArtPieces < ActiveRecord::Migration[8.0]
  def change
    change_table :art_pieces, bulk: true do |t|
      t.string :medium, limit: 160
      t.decimal :width, precision: 8, scale: 2
      t.decimal :height, precision: 8, scale: 2
      t.decimal :depth, precision: 8, scale: 2
      t.string :size_unit, limit: 2, null: false, default: 'cm'
      t.integer :year_made
      t.string :edition, limit: 80
      t.integer :availability, null: false, default: 0
    end
  end
end
