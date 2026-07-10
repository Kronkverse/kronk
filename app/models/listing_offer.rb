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

  def accept!
    update!(state: 'accepted')
    listing.update!(state: 'reserved')
  end

  def decline!
    update!(state: 'declined')
  end

  def withdraw!
    update!(state: 'withdrawn')
  end

  private

  def amount_non_negative
    return if amount_cents.nil? || amount_cents >= 0

    errors.add(:amount_cents, 'must not be negative')
  end
end
