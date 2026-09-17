# frozen_string_literal: true

# A buyer-side offer against a listing. `amount_cents` nil means "at
# listed price"; a value means a counter-offer.
class ListingOffer < ApplicationRecord
  STATES = %w(pending accepted declined withdrawn expired).freeze

  belongs_to :listing
  belongs_to :offerer, class_name: 'Account'

  validates :state, inclusion: { in: STATES }
  validate  :amount_non_negative

  scope :pending,  -> { where(state: 'pending') }
  scope :accepted, -> { where(state: 'accepted') }

  after_commit :publish_wachuneed_offer_made, on: :create

  def accept!
    update!(state: 'accepted')
    listing.update!(state: 'reserved')
    publish_offer_response('wachuneed.offer.accepted')
  end

  def decline!
    update!(state: 'declined')
    publish_offer_response('wachuneed.offer.declined')
  end

  def withdraw!
    update!(state: 'withdrawn')
  end

  private

  def amount_non_negative
    return if amount_cents.nil? || amount_cents >= 0

    errors.add(:amount_cents, 'must not be negative')
  end

  # wachuneed.offer.made — buyer offers on a listing; Nudges routes
  # to the seller's Mate chat with the offerer (if Mates).
  def publish_wachuneed_offer_made
    Kronk::KornerEvents.publish(
      'wachuneed.offer.made',
      actor_account_id: offerer_id,
      recipient_account_id: listing.account_id,
      listing_id: listing_id,
      offer_id: id
    )
  end

  # Buyer-facing response direction: seller accepts or declines the
  # buyer's offer; Nudges routes to the buyer's Mate chat with the
  # seller. Actor = seller (they took the action); recipient =
  # offerer (they see the outcome).
  def publish_offer_response(event_name)
    Kronk::KornerEvents.publish(
      event_name,
      actor_account_id: listing.account_id,
      recipient_account_id: offerer_id,
      listing_id: listing_id,
      offer_id: id
    )
  end
end
