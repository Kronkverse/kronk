# frozen_string_literal: true

# What a piece is made of and how big it is, when it was made, its edition,
# and whether it can be had (docs/spaces/art.md, Piece details).
#
# One add_column per column rather than a change_table block, which
# strong_migrations can't see inside and refuses.
class AddDetailsToArtPieces < ActiveRecord::Migration[8.0]
  def change
    add_column :art_pieces, :medium, :string, limit: 160
    add_column :art_pieces, :width, :decimal, precision: 8, scale: 2
    add_column :art_pieces, :height, :decimal, precision: 8, scale: 2
    add_column :art_pieces, :depth, :decimal, precision: 8, scale: 2
    add_column :art_pieces, :size_unit, :string, limit: 2, null: false, default: 'cm'
    add_column :art_pieces, :year_made, :integer
    add_column :art_pieces, :edition, :string, limit: 80
    add_column :art_pieces, :availability, :integer, null: false, default: 0
  end
end
