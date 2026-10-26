# frozen_string_literal: true

# Art — a single physical work by one author, with one or more photos
# of it (multiple angles / details of the same piece). Unlike an
# Albutts Album, an ArtPiece is single-contributor by design: photos
# of a sculpture from different angles are still authored by the
# artist. Its audience is the reach ladder plus any Krews it is for
# (`record_krews`, Kronk::KrewAudience).
#
# See docs/korners/art (TBD) and config/korners/art.yaml.
class ArtPiece < ApplicationRecord
  include Reachable
  include Kronk::OwnUploads
  include Kronk::AttachmentSource
  include Kronk::AudienceBearer
  include Kronk::KrewAudience

  self.attachment_source_slug = 'art'

  belongs_to :owner, class_name: 'Account'
  belongs_to :cover_media_attachment, class_name: 'MediaAttachment', optional: true

  owns_uploads :cover_media_attachment, owner: :owner_id
  belongs_to :status, optional: true, inverse_of: :art_piece

  has_many :photos, class_name: 'ArtPiecePhoto', dependent: :destroy, inverse_of: :art_piece

  # What kind of work it is. `other` is for anything none of these fit.
  # New kinds take the next number (the column stores the number), and
  # need naming in app/javascript/mastodon/features/art/kinds.ts too.
  enum :kind,
       {
         painting: 0, sculpture: 1, print: 2, drawing: 3, ceramic: 4, photograph: 5, other: 6,
         textile: 7, illustration: 8, collage: 9, mixed_media: 10, installation: 11, mural: 12,
         glass: 13, jewellery: 14, woodwork: 15, metalwork: 16, calligraphy: 17, papercraft: 18
       },
       suffix: :kind

  # Reach ladder. Krews are an additive axis on top (see class comment).
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope

  # Whether the piece can be had (docs/spaces/art.md, Piece details).
  # New states take the next number.
  enum :availability,
       { not_for_sale: 0, available: 1, sold: 2, commissioned: 3, on_show: 4 },
       prefix: :availability

  SIZE_UNITS = %w(cm in).freeze

  # A price is whole cents of a three-letter currency (AUD for now, as in
  # Wachuneed), under a billion.
  PRICE_MAX_CENTS = 100_000_000_000

  MEDIUMS_LIMIT = 6

  # Tidy as picked: trimmed, blanks dropped, no repeats (ignoring case).
  def mediums=(value)
    super(Array(value).map { |medium| medium.to_s.squish.first(ArtPortfolio::MEDIUM_LENGTH) }.compact_blank.uniq(&:downcase))
  end

  validates :title, presence: true, length: { maximum: 240 }
  validates :mediums, length: { maximum: MEDIUMS_LIMIT }
  validates :medium, length: { maximum: 160 }, allow_blank: true
  validates :edition, length: { maximum: 80 }, allow_blank: true
  validates :width, :height, :depth, numericality: { greater_than: 0, less_than: 100_000 }, allow_nil: true
  validates :size_unit, inclusion: { in: SIZE_UNITS }
  validates :year_made, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: ->(_) { Time.current.year + 1 } }, allow_nil: true
  validates :description, length: { maximum: 4000 }, allow_blank: true
  validates :price_cents, numericality: { only_integer: true, greater_than: 0, less_than: PRICE_MAX_CENTS }, allow_nil: true
  validates :price_currency, length: { is: 3 }

  scope :recent, -> { order(created_at: :desc) }

  # A medium a piece is put in joins its artist's portfolio mediums, so the
  # chips there and the pieces stay in step. Only once they have a portfolio:
  # before that, setting one up offers the mediums their pieces already use.
  after_save :add_mediums_to_portfolio, if: :saved_change_to_mediums?

  # Reachable adapter — reach visibility (visible_to / visible_to?)
  # lives in the concern; these tell it how an ArtPiece stores its
  # owner and its Krews.
  def self.reachable_owner_column
    :owner_id
  end

  def self.reachable_krew_scope(krew_ids)
    audience_krew_scope(krew_ids)
  end

  private

  def add_mediums_to_portfolio
    portfolio = owner.art_portfolio
    return if portfolio.nil?

    known = portfolio.mediums.map(&:downcase)
    missing = mediums.reject { |medium| known.include?(medium.downcase) }
    return if missing.empty?

    room = ArtPortfolio::MEDIUMS_LIMIT - portfolio.mediums.size
    portfolio.update(mediums: portfolio.mediums + missing.first([room, 0].max)) if room.positive?
  end

  # Reachable adapter (instance side).
  def reachable_owner_id
    owner_id
  end

  def reachable_owner
    owner
  end

  def reachable_krew_member?(viewer)
    audience_krew_member?(viewer)
  end
end
