# frozen_string_literal: true

# A seller's shop front in Wachuneed (docs/spaces/wachuneed.md, Shops). One
# per account, opened by choice. It holds no listings of its own: it is the
# seller's live offers on one page, grouped under the sections they name.
class ListingShop < ApplicationRecord
  include Reachable

  # Who can message the seller is now who can see the shop (visibility);
  # the column goes in a later migration.
  self.ignored_columns += %w(enquiries)

  MAX_SECTIONS = 12
  # How many of a shop's items show on its card and across its banner.
  PREVIEW_PHOTOS = 4

  belongs_to :account
  belongs_to :media_attachment, optional: true
  has_many :sections, -> { order(:position, :id) }, class_name: 'ListingShopSection', dependent: :destroy, inverse_of: :listing_shop

  validates :name, presence: true, length: { maximum: 60 }
  validates :description, length: { maximum: 300 }
  # Said once for the whole shop and shown on every item of it.
  validates :payment, :handover, length: { maximum: 500 }
  validates :based_in, length: { maximum: 80 }
  validates :about, length: { maximum: 2000 }
  validates :account_id, uniqueness: true

  # Who can see the shop page, on the reach ladder; whoever can see it can
  # message the seller from it. Also where a new shop item starts. No Krew.
  # Typed here as well, so older migrations that load this model before the
  # column exists still boot.
  attribute :visibility, :integer, default: 0
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :reach, validate: true

  # Shops with something in them: an empty shop is not worth a card.
  scope :stocked, -> { where(account_id: Listing.live.offers.select(:account_id)) }

  # Whether `sender` may start a chat with `seller` without a listing: the
  # seller has a shop and `sender` can see it (docs/spaces/wachuneed.md,
  # Who can see it).
  def self.messageable?(seller, sender:)
    return false if seller.nil? || sender.nil? || seller.id == sender.id
    return false if sender.blocking?(seller)

    find_by(account_id: seller.id)&.visible_to?(sender) || false
  end

  def self.reachable_owner_column
    :account_id
  end

  def self.reachable_krew_scope(_krew_ids)
    none
  end

  # The cover photos of each seller's newest live offers that `viewer` can
  # see, by account id: what a shop's card and banner show of what is
  # inside. One query for every shop asked about.
  def self.preview_photos_for(account_ids, viewer)
    previews = Hash.new { |hash, key| hash[key] = [] }
    listings = Listing.visible_to(viewer).live.offers
                      .where(account_id: account_ids, id: ListingPhoto.select(:listing_id))
                      .includes(listing_photos: :media_attachment)
                      .order(created_at: :desc)
                      .limit(600)

    listings.each do |listing|
      shown = previews[listing.account_id]
      next if shown.size >= PREVIEW_PHOTOS

      url = listing.listing_photos.first&.media_attachment&.file&.url(:small)
      shown << url if url
    end

    previews
  end

  # The shop's live offers that `viewer` can see.
  def live_offers(viewer)
    Listing.visible_to(viewer).live.offers.where(account_id: account_id)
  end

  # Replace the sections with `rows` (each `{ id:, name: }`, in order):
  # a row with a known id is renamed and moved, one without is created,
  # and a section left out is removed (its listings fall back to
  # "Everything else").
  def replace_sections!(rows)
    rows = Array(rows).first(MAX_SECTIONS)
    kept = []

    transaction do
      rows.each_with_index do |row, position|
        name = row[:name].to_s.strip
        next if name.blank?

        section = sections.find { |s| s.id.to_s == row[:id].to_s } if row[:id].present?
        section ||= sections.build
        section.update!(name: name, position: position)
        kept << section.id
      end

      sections.where.not(id: kept).destroy_all
    end

    sections.reset
  end

  private

  def reachable_owner_id
    account_id
  end

  def reachable_owner
    account
  end

  def reachable_krew_member?(_viewer)
    false
  end
end
