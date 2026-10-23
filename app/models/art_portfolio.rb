# frozen_string_literal: true

# An artist's portfolio in Art (docs/spaces/art.md, Portfolio). One per
# account, made the first time they save one; until then a portfolio is just
# their pieces. Which pieces lead it is kept on the pieces
# (`art_pieces.featured_position`), so deleting a piece takes it off.
class ArtPortfolio < ApplicationRecord
  STATEMENT_LIMIT = 2000
  FEATURED_LIMIT = 3

  belongs_to :account

  validates :statement, length: { maximum: STATEMENT_LIMIT }, allow_blank: true

  # The owner's pieces in the order they chose to lead with.
  def self.featured_pieces_of(account)
    account.owned_art_pieces.where.not(featured_position: nil).order(:featured_position)
  end

  # Lead with these pieces, in this order (at most FEATURED_LIMIT of the
  # owner's own); every other piece stops being featured.
  def self.feature!(account, piece_ids)
    ids = Array(piece_ids).map(&:to_s).uniq
    own = account.owned_art_pieces.where(id: ids).pluck(:id).map(&:to_s)
    ids = (ids & own).first(FEATURED_LIMIT)

    ArtPiece.transaction do
      account.owned_art_pieces.where.not(featured_position: nil).update_all(featured_position: nil)
      ids.each_with_index { |id, index| account.owned_art_pieces.where(id: id).update_all(featured_position: index + 1) }
    end
  end
end
