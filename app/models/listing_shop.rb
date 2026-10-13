# frozen_string_literal: true

# A seller's shop front in Wachuneed (docs/spaces/wachuneed.md, Shops). One
# per account, opened by choice. It holds no listings of its own: it is the
# seller's live offers on one page, grouped under the sections they name.
class ListingShop < ApplicationRecord
  ENQUIRIES    = %w(mates anyone).freeze
  MAX_SECTIONS = 12

  belongs_to :account
  belongs_to :media_attachment, optional: true
  has_many :sections, -> { order(:position, :id) }, class_name: 'ListingShopSection', dependent: :destroy, inverse_of: :listing_shop

  validates :name, presence: true, length: { maximum: 60 }
  validates :description, length: { maximum: 300 }
  validates :enquiries, inclusion: { in: ENQUIRIES }
  validates :account_id, uniqueness: true

  # Shops with something in them: an empty shop is not worth a card.
  scope :stocked, -> { where(account_id: Listing.live.offers.select(:account_id)) }

  # A seller who opens enquiries to anyone has invited a message about what
  # they list, so the Mates-only rule for starting a chat gives way for
  # them (Tal 2026-10-12: the seller decides per shop).
  def self.enquiries_open?(account)
    account.present? && exists?(account_id: account.id, enquiries: 'anyone')
  end

  def live_offers
    Listing.live.offers.where(account_id: account_id)
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
end
