# frozen_string_literal: true

# One date a ticketed listing runs on (docs/spaces/wachuneed.md, Tickets):
# when, where, how many seats, and the Kalendar event made for it
# (Wachuneed::TicketDates). A seat is taken when the seller accepts a
# request for it; nothing waiting holds one.
class ListingTicketDate < ApplicationRecord
  MAX_PER_LISTING = 20
  MAX_SEATS = 10_000

  belongs_to :listing
  belongs_to :event, optional: true
  has_many :listing_offers, foreign_key: :ticket_date_id, inverse_of: :ticket_date, dependent: :nullify

  validates :starts_at, presence: true
  validates :place, length: { maximum: 200 }
  validates :seats, numericality: { only_integer: true, in: 1..MAX_SEATS }, allow_nil: true
  validate :ends_after_start

  scope :upcoming, -> { where(starts_at: Time.current..) }

  def seats_taken
    listing_offers.accepted.sum(:quantity)
  end

  # Nil when the date has no limit.
  def seats_left
    seats && [seats - seats_taken, 0].max
  end

  def room_for?(quantity)
    seats.nil? || seats_left >= quantity.to_i
  end

  private

  def ends_after_start
    errors.add(:ends_at, 'must be after the start') if ends_at && starts_at && ends_at <= starts_at
  end
end
