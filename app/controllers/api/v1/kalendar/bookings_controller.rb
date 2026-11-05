# frozen_string_literal: true

# Your accepted bookings, both ways (docs/spaces/wachuneed.md, Booking;
# docs/spaces/kalendar.md, Me): what you booked from someone and what was
# booked from you, from today for WINDOW_DAYS, soonest first. Read from
# Wachuneed's requests as they stand, like birthdays, so a booking called
# off is gone at once and nothing is kept twice. Only the two of them ever
# see one.
class Api::V1::Kalendar::BookingsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  WINDOW_DAYS = 90

  def index
    upcoming = ListingOffer.accepted.where(starts_at: Time.current.beginning_of_day..WINDOW_DAYS.days.from_now)
    bookings = upcoming.where(offerer: current_account)
                       .or(upcoming.where(listing_id: Listing.where(account: current_account).select(:id)))
                       .includes(:offerer, listing: :account).order(:starts_at).limit(100)

    render json: bookings.map { |booking| entry(booking) }
  end

  private

  def entry(booking)
    seller = booking.listing.account_id == current_account.id
    with   = seller ? booking.offerer : booking.listing.account

    {
      id: booking.id.to_s,
      starts_at: booking.starts_at.iso8601,
      ends_at: booking.ends_at&.iso8601,
      title: booking.listing.title,
      listing: { id: booking.listing.id.to_s, slug: booking.listing.slug },
      side: seller ? 'seller' : 'buyer',
      with: REST::AccountSerializer.new(with, scope: current_user, scope_name: :current_user).as_json,
    }
  end
end
