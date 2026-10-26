# frozen_string_literal: true

# An artist's portfolio in Art (docs/spaces/art.md, Portfolio). One per
# account, made the first time they save one; until then a portfolio is just
# their pieces. Which pieces lead it is kept on the pieces
# (`art_pieces.featured_position`), so deleting a piece takes it off.
class ArtPortfolio < ApplicationRecord
  STATEMENT_LIMIT = 2000
  FEATURED_LIMIT = 3
  MEDIUMS_LIMIT = 12
  MEDIUM_LENGTH = 40
  COMMISSION_NOTE_LIMIT = 200

  belongs_to :account

  validates :statement, length: { maximum: STATEMENT_LIMIT }, allow_blank: true
  # What commissions start from, and a line about them; both optional.
  validates :commission_price_cents, numericality: { only_integer: true, greater_than: 0, less_than: ArtPiece::PRICE_MAX_CENTS }, allow_nil: true
  validates :commission_currency, length: { is: 3 }
  validates :commission_note, length: { maximum: COMMISSION_NOTE_LIMIT }, allow_blank: true
  validate :mediums_are_short_and_few

  # Tidy as typed: trimmed, blanks dropped, no repeats (ignoring case).
  def mediums=(value)
    super(Array(value).map { |medium| medium.to_s.squish }.compact_blank.uniq(&:downcase))
  end

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

  private

  def mediums_are_short_and_few
    errors.add(:mediums, "at most #{MEDIUMS_LIMIT}") if mediums.size > MEDIUMS_LIMIT
    errors.add(:mediums, "each at most #{MEDIUM_LENGTH} characters") if mediums.any? { |medium| medium.length > MEDIUM_LENGTH }
  end
end
