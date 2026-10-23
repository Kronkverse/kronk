# frozen_string_literal: true

# An artist's portfolio in Art (docs/spaces/art.md, Portfolio): a statement,
# whether they're open for commissions, and which of their pieces lead it.
class CreateArtPortfolios < ActiveRecord::Migration[8.0]
  def change
    create_table :art_portfolios do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.text :statement
      t.boolean :open_for_commissions, null: false, default: false
      t.timestamps
    end

    # A featured piece's place at the head of its owner's portfolio (1–3);
    # nil when it isn't featured.
    add_column :art_pieces, :featured_position, :integer
  end
end
