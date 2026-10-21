# frozen_string_literal: true

# A request for a listing on offer (docs/spaces/wachuneed.md, Requests): a
# buyer asks for it, with the kind and extras they chose and how many, and
# the seller accepts or declines. Kronk takes no payment; an accepted
# request is the two of them agreeing, and the rest happens in their chat.
#
# What was chosen is kept as it was asked (`choices`, `total_cents`), so a
# later edit to the listing doesn't change a request already made.
# `amount_cents` is a counter-offer, which nothing makes yet.
class ListingOffer < ApplicationRecord
  STATES       = %w(pending accepted declined withdrawn expired).freeze
  MAX_QUANTITY = 99

  belongs_to :listing
  belongs_to :offerer, class_name: 'Account'

  validates :state, inclusion: { in: STATES }
  validates :quantity, numericality: { only_integer: true, in: 1..MAX_QUANTITY }
  validates :message, length: { maximum: 1000 }
  validate  :amount_non_negative
  validate  :can_be_asked, on: :create
  validate  :choices_on_offer, on: :create

  scope :pending,  -> { where(state: 'pending') }
  scope :accepted, -> { where(state: 'accepted') }
  scope :recent,   -> { order(created_at: :desc) }

  after_commit :publish_wachuneed_offer_made, on: :create

  # A request built from what the buyer picked on the listing page:
  # `variant` is a choice per variation, in the seller's order; `options`
  # is [{ name:, choice: }]. Anything that doesn't match the listing is an
  # error rather than a guess.
  def self.ask(listing, offerer:, variant: nil, options: nil, quantity: 1, message: nil)
    request = new(listing: listing, offerer: offerer, quantity: quantity.to_i, message: message.to_s.strip.presence)
    request.choose(variant, options)
    request
  end

  def choose(variant, options)
    @unmatched = []
    kind   = pick_kind(Array(variant).map(&:to_s))
    extras = pick_extras(Array(options))
    return if @unmatched.any?

    self.choices = { 'variant' => kind ? kind['values'] : [], 'options' => extras }
    unit = kind ? kind['price_cents'] : listing.price_cents
    self.price_currency = listing.price_currency
    self.total_cents    = unit && ((unit + extras.sum { |extra| extra['extra_cents'] }) * quantity.to_i)
  end

  def pending?
    state == 'pending'
  end

  # A one-off is reserved for the buyer; something the seller keeps making
  # stays up for the next one.
  def accept!
    transaction do
      update!(state: 'accepted', responded_at: Time.current)
      listing.update!(state: 'reserved') if !listing.ongoing? && listing.state == 'live'
    end
    publish_offer_response('wachuneed.offer.accepted')
  end

  def decline!
    update!(state: 'declined', responded_at: Time.current)
    publish_offer_response('wachuneed.offer.declined')
  end

  def withdraw!
    update!(state: 'withdrawn', responded_at: Time.current)
  end

  private

  def pick_kind(values)
    return if listing.variants['items'].blank?

    kind = listing.variants['items'].find { |item| item['values'] == values }
    return kind unless kind.nil? || %w(off sold_out).include?(kind['availability'])

    @unmatched << 'Choose one of the kinds on offer'
    nil
  end

  def pick_extras(picks)
    picks.filter_map do |pick|
      pick   = pick.respond_to?(:to_unsafe_h) ? pick.to_unsafe_h : pick.to_h
      option = Array(listing.options).find { |o| o['name'] == pick.stringify_keys['name'].to_s }
      choice = option && option['choices'].find { |c| c['label'] == pick.stringify_keys['choice'].to_s }
      if choice.nil?
        @unmatched << 'Choose from the extras on offer'
        next
      end

      { 'name' => option['name'], 'choice' => choice['label'], 'extra_cents' => choice['extra_cents'].to_i }
    end
  end

  # Only something on offer and still up, never your own, only by someone
  # who can see it (and so message about it), and one open request each.
  def can_be_asked
    return if listing.nil? || offerer.nil?

    if listing.wanted? || listing.state != 'live' || listing.availability == 'sold_out'
      errors.add(:base, 'This is not on offer')
    elsif !listing.messageable_by?(offerer)
      errors.add(:base, 'You cannot ask for this')
    elsif listing.listing_offers.pending.exists?(offerer_id: offerer.id)
      errors.add(:base, 'You have already asked for this')
    end
  end

  # What `choose` couldn't match on the listing.
  def choices_on_offer
    Array(@unmatched).uniq.each { |problem| errors.add(:base, problem) }
  end

  def amount_non_negative
    return if amount_cents.nil? || amount_cents >= 0

    errors.add(:amount_cents, 'must not be negative')
  end

  # wachuneed.offer.made: the seller hears that someone asked.
  def publish_wachuneed_offer_made
    Kronk::KornerEvents.publish(
      'wachuneed.offer.made',
      actor_account_id: offerer_id,
      recipient_account_id: listing.account_id,
      listing_id: listing_id,
      offer_id: id
    )
  end

  # The buyer hears what the seller said. Actor = seller, recipient = buyer.
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
