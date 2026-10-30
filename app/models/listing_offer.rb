# frozen_string_literal: true

# A request for a listing on offer (docs/spaces/wachuneed.md, Requests): a
# buyer asks for it, with the kind and extras they chose and how many, and
# the seller accepts or declines. Kronk takes no payment; an accepted
# request is the two of them agreeing, and the rest happens in their chat.
#
# What was chosen is kept as it was asked (`choices`, `total_cents`), so a
# later edit to the listing doesn't change a request already made.
# `amount_cents` is a counter-offer, which nothing makes yet.
#
# For a listing that is booked (Listing::BOOKING_PARTS) the request is a
# booking: it also carries what the parts ask for, a time (`starts_at`,
# with `ends_at` when the listing has a set length), a from and a to
# (`route`, seen only by the two of them) and the person's `details`. An
# accepted booking can be called off by either side (`cancel!`).
class ListingOffer < ApplicationRecord
  STATES       = %w(pending accepted declined withdrawn expired cancelled).freeze
  MAX_QUANTITY = 99
  # A booking waiting or accepted holds its time.
  HELD_STATES  = %w(pending accepted).freeze

  belongs_to :listing
  belongs_to :offerer, class_name: 'Account'
  belongs_to :cancelled_by, class_name: 'Account', optional: true

  validates :state, inclusion: { in: STATES }
  validates :quantity, numericality: { only_integer: true, in: 1..MAX_QUANTITY }
  validates :message, length: { maximum: 1000 }
  validates :details, length: { maximum: 1000 }
  validate  :amount_non_negative
  validate  :can_be_asked, on: :create
  validate  :choices_on_offer, on: :create
  validate  :booking_given, on: :create

  scope :pending,  -> { where(state: 'pending') }
  scope :accepted, -> { where(state: 'accepted') }
  scope :held,     -> { where(state: HELD_STATES) }
  scope :recent,   -> { order(created_at: :desc) }

  after_commit :publish_wachuneed_offer_made, on: :create

  # A request built from what the buyer picked on the listing page:
  # `variant` is a choice per variation, in the seller's order; `options`
  # is [{ name:, choice: }]. Anything that doesn't match the listing is an
  # error rather than a guess.
  def self.ask(listing, offerer:, variant: nil, options: nil, quantity: 1, message: nil, starts_at: nil, route: nil, details: nil)
    request = new(listing: listing, offerer: offerer, quantity: quantity.to_i, message: message.to_s.strip.presence)
    request.choose(variant, options)
    request.book(starts_at, route, details) if listing.bookable?
    request
  end

  # What the listing's booking parts ask for, and only that.
  def book(starts_at, route, details)
    parts = listing.booking['parts']
    if parts.include?('time')
      self.starts_at = parse_time(starts_at)
      minutes = listing.booking['minutes'].to_i
      self.ends_at = self.starts_at + minutes.minutes if self.starts_at && minutes.positive?
    end
    self.route   = clean_route(route) if parts.include?('route')
    self.details = details.to_s.strip.presence if parts.include?('details')
  end

  def booking?
    starts_at.present? || route.present? || details.present?
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
  # A booked listing stays up for the next booking.
  def accept!
    transaction do
      update!(state: 'accepted', responded_at: Time.current)
      listing.update!(state: 'reserved') if !listing.ongoing? && !listing.bookable? && listing.state == 'live'
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

  # Either of the two calls an accepted booking off; its time opens again
  # and the other one hears.
  def cancel!(by:)
    update!(state: 'cancelled', cancelled_at: Time.current, cancelled_by: by)
    Kronk::KornerEvents.publish(
      'wachuneed.offer.cancelled',
      actor_account_id: by.id,
      recipient_account_id: by.id == offerer_id ? listing.account_id : offerer_id,
      listing_id: listing_id,
      offer_id: id
    )
  end

  private

  def parse_time(value)
    return value.utc if value.is_a?(Time) || value.is_a?(ActiveSupport::TimeWithZone)

    Time.zone.parse(value.to_s)&.utc
  rescue ArgumentError
    nil
  end

  # A from and a to, each a point on the Map with an optional name.
  def clean_route(value)
    value = Listing.plain(value)
    return {} unless value.is_a?(Hash)

    %w(from to).each_with_object({}) do |end_name, route|
      point = Listing.plain(value[end_name])
      next unless point.is_a?(Hash)

      lat = Float(point['lat'], exception: false)
      lng = Float(point['lng'], exception: false)
      next unless lat&.between?(-90, 90) && lng&.between?(-180, 180)

      route[end_name] = { 'lat' => lat.round(6), 'lng' => lng.round(6), 'name' => point['name'].to_s.strip.first(200).presence }.compact
    end
  end

  # Everything the listing's parts ask for, and a time that is free.
  def booking_given
    return if listing.nil? || !listing.bookable?

    parts = listing.booking['parts']
    if parts.include?('time')
      if starts_at.nil?
        errors.add(:base, 'Choose a time')
      elsif !Wachuneed::BookingTimes.new(listing).free?(starts_at)
        errors.add(:base, 'That time is not free')
      end
    end
    errors.add(:base, 'Give a from and a to') if parts.include?('route') && route.keys.sort != %w(from to)
    errors.add(:base, 'Say what you need') if parts.include?('details') && details.blank?
  end

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
    elsif !listing.bookable? && listing.listing_offers.pending.exists?(offerer_id: offerer.id)
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
