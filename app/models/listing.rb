# frozen_string_literal: true

# Wachuneed listing — the primary Wachuneed resource (renamed from
# `Marketplace` 2026-07-21). States move forward through draft → live →
# (reserved | closed). Closing sets `closed_at`; reopening a closed
# listing means creating a fresh row.
class Listing < ApplicationRecord
  include Searchable
  include Reachable
  include Kronk::AttachmentSource
  include Kronk::AudienceBearer
  include Kronk::KrewAudience
  include Kronk::PeopleAudience
  # Where it is: its Konnected Place, when its own `location` is empty.
  include Kronk::RecordPlace::Konnected
  include Kronk::NamedLink

  self.attachment_source_slug = 'wachuneed'

  # Who can message the poster is now who can see the listing (visibility);
  # the column goes in a later migration.
  self.ignored_columns += %w(enquiries)

  searchable_as :wachuneed_listings

  def as_json_for_search
    {
      id: id,
      title: title.to_s,
      description: description.to_s,
      category: category.to_s,
      subcategory: subcategory.to_s,
      account_id: account_id,
      state: state,
      kind: kind,
      visibility: visibility,
      price_currency: price_currency.to_s,
      price_cents: price_cents.to_i,
      created_at: created_at&.to_i,
    }
  end

  CATEGORIES = %w(creation goods service).freeze
  STATES     = %w(draft live reserved closed).freeze
  # `offer`: something on offer (the Offered section). `wanted`:
  # something someone is looking for (the Desired section). Price on a
  # wanted listing reads as a budget.
  KINDS      = %w(offer wanted).freeze
  # What it offers, chosen first in the composer (docs/spaces/wachuneed.md,
  # What are you offering?). Null is a product, as every older listing is.
  OFFERINGS  = %w(product appointment service trip tickets lesson).freeze

  # How the price reads (docs/spaces/wachuneed.md, Prices). `fixed`: the
  # amount (a wanted ad's is what the poster pays). `up_to`: a wanted ad's
  # most. `offers`, `quote`, `trade`, `free` and `donation` (a lesson open
  # to all, with the seller asking for support) carry no amount. Null reads
  # as `fixed`, as every older listing does.
  PRICE_TYPES   = %w(fixed up_to offers quote trade free donation).freeze
  PRICE_AMOUNTS = %w(fixed up_to).freeze
  # What the amount is for: an hour of work, a day... Null is the whole
  # thing.
  PRICE_UNITS   = %w(hour day week month session).freeze

  # What a wanted ad is after (docs/spaces/wachuneed.md, Wanted ads),
  # picked first in its composer: a `thing` someone has, something `made`
  # for the poster, a `job` done, or someone to `help` for a time. Null on
  # anything on offer, and on older wanted ads (read as a thing).
  LOOKING_FOR = %w(thing made job help).freeze
  # Where the work happens, for anything but a thing. In person or either
  # says where in `location`.
  WHERE_MODES = %w(online in_person either).freeze
  # How many people a wanted ad can take on (an open call).
  MAX_SPOTS   = 20

  # Options (docs/spaces/wachuneed.md, Options): up to MAX_OPTIONS named
  # groups, each of up to MAX_OPTION_CHOICES choices that may add to the
  # price. Stored as JSON on the listing.
  MAX_OPTIONS        = 6
  MAX_OPTION_CHOICES = 12
  MAX_OPTION_EXTRA   = 10_000_000 # cents

  # Whether there is one to be had (docs/spaces/wachuneed.md, The shop
  # builder). A seller flips it; nothing is counted.
  AVAILABILITIES = %w(available sold_out made_to_order).freeze
  # A combination the seller does not offer at all is `off`.
  VARIANT_AVAILABILITIES = (AVAILABILITIES + %w(off)).freeze

  # Variants: what an item comes in. Up to MAX_VARIANT_AXES named choices
  # ("Size", "Colour"), in the order the seller wants them asked, and one
  # entry per combination with its own price and availability.
  MAX_VARIANT_AXES   = 3
  MAX_VARIANT_VALUES = 10
  MAX_VARIANTS       = 60

  # Booking (docs/spaces/wachuneed.md, Booking; Kommons "Goods & Services"):
  # a listing on offer can be built from parts, each one something the person
  # booking it gives. `time`: when, from the seller's weekly hours, the times
  # they post, or (with neither) a time the person suggests. `route`: a from
  # and a to on the Map, for a job. `details`: what they need, in their own
  # words. The templates are only where the composer starts; what is stored
  # is the parts the seller kept.
  BOOKING_PARTS     = %w(time route details).freeze
  # Where an appointment happens; `either` lets the person booking choose
  # (the composer adds a Where choice for it).
  BOOKING_WHERES    = %w(online in_person either).freeze
  # An appointment can come in lengths, each a kind (a Length variation)
  # with its own price; `lengths` says how long each one books.
  MAX_BOOKING_LENGTHS = 10
  BOOKING_TEMPLATES = %w(appointment job request).freeze
  BOOKING_MINUTES   = (5..1440)
  MAX_BOOKING_HOURS = 21
  MAX_BOOKING_SLOTS = 60
  BOOKING_TIME      = /\A([01]\d|2[0-3]):[0-5]\d\z/

  belongs_to :account
  # First photo is the cover (docs/spaces/wachuneed.md).
  MAX_PHOTOS = 10
  # A lesson (docs/spaces/wachuneed.md, Lessons): what it teaches with, and
  # how long its text and the seller's way to be paid may run.
  MAX_LESSON_MEDIA = 20
  MAX_LESSON_BODY  = 20_000
  MAX_PAY_DETAILS  = 500
  # A lesson anyone who can see it may open: free, or for a donation.
  OPEN_LESSON_PRICES = %w(free donation).freeze

  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :listing
  has_many   :listing_photos, -> { order(:position) }, dependent: :destroy, inverse_of: :listing
  has_many   :media_attachments, through: :listing_photos
  # A lesson's own uploads, locked with it; never among the photos.
  has_many   :listing_lesson_media, -> { order(:position) }, dependent: :destroy, inverse_of: :listing
  has_many   :listing_offers, dependent: :destroy
  # Tickets (docs/spaces/wachuneed.md, Tickets): the dates it runs on.
  has_many   :ticket_dates, -> { order(:starts_at) }, class_name: 'ListingTicketDate', dependent: :destroy, inverse_of: :listing
  # Where it sits in the seller's shop, if they have one and chose a section.
  belongs_to :listing_shop_section, optional: true

  validates :title,    presence: true, length: { maximum: 200 }
  validates :category, inclusion: { in: CATEGORIES }
  validates :state,    inclusion: { in: STATES }
  validates :kind,     inclusion: { in: KINDS }
  validates :offering, inclusion: { in: OFFERINGS }, allow_nil: true
  # Sold on another platform: where to get the tickets.
  validates :ticket_url, length: { maximum: 400 }, format: { with: %r{\Ahttps?://\S+\z} }, allow_blank: true
  validates :lesson_body, length: { maximum: MAX_LESSON_BODY }
  validates :pay_details, length: { maximum: MAX_PAY_DETAILS }
  validates :availability, inclusion: { in: AVAILABILITIES }
  validates :looking_for, inclusion: { in: LOOKING_FOR }, allow_nil: true
  validates :where_mode, inclusion: { in: WHERE_MODES }, allow_nil: true
  validates :spots, numericality: { only_integer: true, in: 1..MAX_SPOTS }
  validates :price_type, inclusion: { in: PRICE_TYPES }, allow_nil: true
  validates :price_unit, inclusion: { in: PRICE_UNITS }, allow_nil: true
  validate  :up_to_is_wanted
  validates :price_currency, length: { is: 3 }, allow_nil: true
  validate  :price_cents_non_negative
  validate  :shop_section_is_own
  validate  :state_moves_forward, on: :update

  scope :live,      -> { where(state: 'live') }
  scope :active,    -> { where.not(state: 'closed') }
  scope :closed,    -> { where(state: 'closed') }
  scope :by_category, ->(cat) { where(category: cat) }
  scope :offers,    -> { where(kind: 'offer') }
  scope :wanted,    -> { where(kind: 'wanted') }
  # The seller's order in their shop: what they placed, in their order, after
  # anything not placed yet, newest first (docs/spaces/wachuneed.md, The
  # shop builder).
  scope :in_shop_order, -> { order(Arel.sql('listings.shop_position ASC NULLS FIRST, listings.created_at DESC')) }

  # Who can see it, on the reach ladder (docs/spaces/wachuneed.md, Who can
  # see it), plus any Krews it is for (Kronk::KrewAudience). Who can see it
  # is who can message the poster about it.
  # Typed here as well, so older migrations that load this model before the
  # column exists still boot.
  attribute :visibility, :integer, default: 0
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :reach, validate: true

  before_validation :drop_options_when_wanted
  before_validation :wanted_details_fit
  before_validation :price_from_variants
  before_validation :price_fits_type
  before_validation :lesson_details_fit
  before_save :stamp_closed_at

  # Stored whole and cut to shape here, like the options: the axes the
  # seller named, then every combination of their values, each carrying
  # what was sent for it or starting out available with no price.
  def variants=(value)
    super(self.class.clean_variants(value))
  end

  def self.clean_variants(value)
    value = plain(value)
    return {} unless value.is_a?(Hash)

    # Two variations with the same name are one: Colour added twice, a
    # choice in each, is Colour with both choices.
    named = rows(value['axes']).each_with_object({}) do |axis, found|
      axis = plain(axis)
      next unless axis.is_a?(Hash)

      name = axis['name'].to_s.strip.first(40)
      next if name.blank?

      found[name.downcase] ||= { 'name' => name, 'values' => [] }
      found[name.downcase]['values'] += rows(axis['values']).map { |v| v.to_s.strip.first(40) }
    end

    axes = named.values.filter_map do |axis|
      values = axis['values'].compact_blank.uniq.first(MAX_VARIANT_VALUES)
      { 'name' => axis['name'], 'values' => values } if values.any?
    end.first(MAX_VARIANT_AXES)
    return {} if axes.empty?

    sent = rows(value['items']).filter_map { |item| plain(item) }.select { |item| item.is_a?(Hash) }
                               .map { |item| [rows(item['values']).map(&:to_s), item] }
    first, *rest = axes.pluck('values')

    # A kind takes what was sent for it, or else what was sent for a kind
    # that had all of its choices (so merged variations keep their price).
    items = first.product(*rest).first(MAX_VARIANTS).map do |combination|
      item  = sent.find { |values, _| values == combination }&.last ||
              sent.find { |values, _| (combination - values).empty? }&.last || {}
      price = item['price_cents']

      {
        'values' => combination,
        'price_cents' => price.blank? ? nil : price.to_i.clamp(0, MAX_OPTION_EXTRA),
        'availability' => VARIANT_AVAILABILITIES.include?(item['availability']) ? item['availability'] : 'available',
      }
    end

    { 'axes' => axes, 'items' => items }
  end

  def variants?
    variants['items'].present?
  end

  # The combinations a buyer can actually ask for.
  def offered_variants
    Array(variants['items']).reject { |item| item['availability'] == 'off' }
  end

  # True when the kinds differ in price, so the tile says "From".
  def price_varies?
    offered_variants.pluck('price_cents').compact.uniq.size > 1
  end

  # Whatever arrives is cut to the shape and the limits above, so what is
  # stored can be drawn without checking it again: a blank name or a group
  # with no choices is dropped, an amount below zero adds nothing.
  def options=(value)
    super(self.class.clean_options(value))
  end

  def self.clean_options(value)
    kept = rows(value).filter_map do |option|
      option = plain(option)
      next unless option.is_a?(Hash)

      name    = option['name'].to_s.strip.first(40)
      choices = rows(option['choices']).filter_map do |choice|
        choice = plain(choice)
        next unless choice.is_a?(Hash)

        label = choice['label'].to_s.strip.first(60)
        next if label.blank?

        { 'label' => label, 'extra_cents' => choice['extra_cents'].to_i.clamp(0, MAX_OPTION_EXTRA) }
      end
      next if name.blank? || choices.empty?

      { 'name' => name, 'choices' => choices.first(MAX_OPTION_CHOICES) }
    end

    kept.first(MAX_OPTIONS)
  end

  # Cut to the parts above like the options are: anything unknown is
  # dropped, settings for a part the seller left out go with it, and a
  # listing with no parts is not booked at all ({}).
  def booking=(value)
    super(self.class.clean_booking(value))
  end

  def self.clean_booking(value)
    value = plain(value)
    return {} unless value.is_a?(Hash)

    parts = BOOKING_PARTS & rows(value['parts']).map(&:to_s)
    return {} if parts.empty?

    booking = { 'parts' => parts }
    booking['template'] = value['template'].to_s if BOOKING_TEMPLATES.include?(value['template'].to_s)
    booking.merge!(clean_booking_time(value)) if parts.include?('time')
    ask = value['ask'].to_s.strip.first(120)
    booking['ask'] = ask if parts.include?('details') && ask.present?
    where = value['where'].to_s
    booking['where'] = where if BOOKING_WHERES.include?(where)
    booking.merge!(clean_booking_lengths(value)) if parts.include?('time')
    booking
  end

  def self.clean_booking_lengths(value)
    lengths = plain(value['lengths'])
    return {} unless lengths.is_a?(Hash)

    kept = lengths.filter_map do |name, minutes|
      name = name.to_s.strip.first(60)
      minutes = minutes.to_i
      [name, minutes] if name.present? && BOOKING_MINUTES.cover?(minutes)
    end.first(MAX_BOOKING_LENGTHS).to_h
    kept.empty? ? {} : { 'lengths' => kept }
  end

  # How long a booking of these choices takes, in minutes: the chosen
  # length's, when the listing comes in lengths, else its one length (nil
  # when it has no set length).
  def booking_minutes_for(values)
    lengths = booking['lengths'] || {}
    chosen = Array(values).map(&:to_s).filter_map { |value| lengths[value] }.first
    minutes = chosen || booking['minutes']
    minutes.presence&.to_i
  end

  # When the seller is free: weekly hours (a day, from, to, in their time
  # zone), times they post (each a start, kept only while it is ahead), or
  # both. `minutes` is how long one booking takes, when there is a set
  # length.
  def self.clean_booking_time(value)
    minutes = value['minutes'].presence&.to_i
    hours = rows(value['hours']).filter_map do |row|
      row = plain(row)
      next unless row.is_a?(Hash)

      day = row['day'].to_s
      from = row['from'].to_s
      to = row['to'].to_s
      next unless day.match?(/\A[0-6]\z/) && from.match?(BOOKING_TIME) && to.match?(BOOKING_TIME) && from < to

      { 'day' => day.to_i, 'from' => from, 'to' => to }
    end
    slots = rows(value['slots']).filter_map do |slot|
      time = Time.zone.parse(slot.to_s)
      time.utc.iso8601 if time&.future?
    rescue ArgumentError
      nil
    end

    {
      'minutes' => (minutes if BOOKING_MINUTES.cover?(minutes)),
      'hours' => hours.uniq.sort_by { |h| [h['day'], h['from']] }.first(MAX_BOOKING_HOURS),
      'slots' => slots.uniq.sort.first(MAX_BOOKING_SLOTS),
      'time_zone' => ActiveSupport::TimeZone[value['time_zone'].to_s] ? value['time_zone'].to_s : 'UTC',
    }.compact
  end

  def bookable?
    booking['parts'].present?
  end

  def tickets?
    offering == 'tickets'
  end

  def lesson?
    offering == 'lesson'
  end

  # A lesson anyone who can see it may open: free, for a donation, or with
  # no price at all. Any other is unlocked person by person.
  def lesson_open?
    lesson? && (OPEN_LESSON_PRICES.include?(price_type) || (price_amount? && price_cents.nil?))
  end

  # Whether `viewer` may open the lesson itself, not just its preview: the
  # seller; anyone who can see an open lesson; anyone whose request to
  # unlock it the seller accepted, while they can still see it.
  def lesson_unlocked_for?(viewer)
    return false unless lesson?
    return true if viewer.present? && viewer.id == account_id
    return false unless visible_to?(viewer)

    lesson_open? || (viewer.present? && listing_offers.accepted.exists?(offerer_id: viewer.id))
  end

  # Tickets bought on another platform, not asked for here.
  def tickets_elsewhere?
    tickets? && ticket_url.present?
  end

  # A list may come as an array, or as a form-encoded hash keyed by index.
  def self.rows(value)
    value = plain(value)
    value.is_a?(Hash) ? value.values : Array(value)
  end

  def self.plain(value)
    value = value.to_unsafe_h if value.respond_to?(:to_unsafe_h)
    value.is_a?(Hash) ? value.stringify_keys : value
  end

  def wanted?
    kind == 'wanted'
  end

  def free_or_by_arrangement?
    price_cents.nil?
  end

  # A price with an amount: a set one, or up to one.
  def price_amount?
    PRICE_AMOUNTS.include?(price_type || 'fixed')
  end

  def close!
    update!(state: 'closed', closed_at: Time.current)
  end

  # Whether `viewer` may start a chat with the poster about this listing
  # (docs/spaces/wachuneed.md, Who can see it): whoever can see it, never
  # the poster, never across a block either way.
  def messageable_by?(viewer)
    return false if viewer.nil? || viewer.id == account_id
    return false if viewer.blocking?(account)

    visible_to?(viewer)
  end

  # Reachable adapter: the seller owns it; its Krews are `record_krews`.
  def self.reachable_owner_column
    :account_id
  end

  def self.reachable_krew_scope(krew_ids)
    audience_krew_scope(krew_ids)
  end

  # A listing someone could still be writing about: up, or reserved.
  def open_for_enquiries?
    %w(live reserved).include?(state)
  end

  # The listing a chat with `poster` is being started about, when it is
  # theirs, still up, and `sender` can see it; nil otherwise. What
  # the Nudges gates ask when a non-Mate opens a chat or sends the first
  # message from "Message the poster": the listing opens that one door, not
  # general messaging.
  def self.enquiry_from(listing_id, sender:, poster:)
    return if listing_id.blank? || sender.nil? || poster.nil?

    listing = find_by(id: listing_id.to_s, account_id: poster.id)
    listing if listing&.open_for_enquiries? && listing.messageable_by?(sender)
  end

  private

  def reachable_owner_id
    account_id
  end

  def reachable_owner
    account
  end

  def reachable_krew_member?(viewer)
    audience_krew_member?(viewer)
  end

  # draft -> live -> reserved -> closed, never back: a closed listing is
  # reopened by making a new one (docs/spaces/wachuneed.md).
  def state_moves_forward
    return unless will_save_change_to_state?
    return if STATES.index(state).to_i >= STATES.index(state_was).to_i

    errors.add(:state, :invalid)
  end

  # Closing by update (state: closed) gets the same stamp as close!.
  def stamp_closed_at
    self.closed_at ||= Time.current if state == 'closed'
  end

  # With variants the listing's own price is the lowest of theirs, so the
  # tile, search and anything that sorts by price keep working.
  def price_from_variants
    self.variants = {} if wanted? && variants.present?
    return unless variants?

    lowest = offered_variants.pluck('price_cents').compact.min
    self.price_cents    = lowest
    self.price_currency = price_currency.presence || 'AUD' if lowest
  end

  # A price with no amount (offers, a quote, a trade, free) keeps none, nor
  # what an amount would be for; and a listing that comes in kinds has a
  # price per kind, so it has no type of its own.
  def price_fits_type
    self.price_type = nil if variants?
    return if price_amount?

    self.price_cents = nil
    self.price_unit  = nil
  end

  # What a wanted ad is after belongs to wanted ads alone, and a thing is
  # one thing, handed over: no where, no more than one taker.
  def wanted_details_fit
    unless wanted?
      self.looking_for = nil
      self.due_on      = nil
    end
    return unless looking_for.nil? || looking_for == 'thing'

    self.where_mode = nil
    self.spots      = 1
  end

  # A lesson's text belongs to a lesson; anything else keeps none. How to
  # pay is said on any listing that is on offer.
  def lesson_details_fit
    self.lesson_body = nil unless lesson?
    self.pay_details = nil if wanted?
  end

  # "Up to" is a budget's ceiling: only something wanted has one.
  def up_to_is_wanted
    errors.add(:price_type, :invalid) if price_type == 'up_to' && !wanted?
  end

  # Options are for something on offer; a wanted ad has nothing to choose.
  def drop_options_when_wanted
    self.options = [] if wanted? && options.present?
    self.booking = {} if wanted? && booking.present?
  end

  def shop_section_is_own
    return if listing_shop_section.nil? || listing_shop_section.listing_shop.account_id == account_id

    errors.add(:listing_shop_section_id, 'is not one of your shop sections')
  end

  def price_cents_non_negative
    return if price_cents.nil? || price_cents >= 0

    errors.add(:price_cents, 'must not be negative')
  end
end
