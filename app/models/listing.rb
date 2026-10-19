# frozen_string_literal: true

# Wachuneed listing — the primary Wachuneed resource (renamed from
# `Marketplace` 2026-07-21). States move forward through draft → live →
# (reserved | closed). Closing sets `closed_at`; reopening a closed
# listing means creating a fresh row.
class Listing < ApplicationRecord
  include Searchable

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
  # Who can message the poster about it (docs/spaces/wachuneed.md,
  # Enquiries): the reach ladder's Mates and Orbit, or anyone on Kronk.
  # Nil follows the seller's shop, else Mates.
  ENQUIRIES  = %w(mates orbit anyone).freeze

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

  belongs_to :account
  # First photo is the cover (docs/spaces/wachuneed.md).
  MAX_PHOTOS = 10

  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :listing
  has_many   :listing_photos, -> { order(:position) }, dependent: :destroy, inverse_of: :listing
  has_many   :media_attachments, through: :listing_photos
  has_many   :listing_offers, dependent: :destroy
  # Where it sits in the seller's shop, if they have one and chose a section.
  belongs_to :listing_shop_section, optional: true

  validates :title,    presence: true, length: { maximum: 200 }
  validates :category, inclusion: { in: CATEGORIES }
  validates :state,    inclusion: { in: STATES }
  validates :kind,     inclusion: { in: KINDS }
  validates :availability, inclusion: { in: AVAILABILITIES }
  validates :enquiries, inclusion: { in: ENQUIRIES }, allow_nil: true
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

  before_validation :drop_options_when_wanted
  before_validation :price_from_variants
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

  def close!
    update!(state: 'closed', closed_at: Time.current)
  end

  # Blank (the form's "not chosen") is stored as nil: follow the shop.
  def enquiries=(value)
    super(value.presence)
  end

  # Who may message the poster about this listing, as the poster chose it
  # (`enquiries`), or, when they didn't, as their shop says, or else Mates.
  def message_reach
    return enquiries if enquiries.present?

    ListingShop.enquiries_open?(account) ? 'anyone' : 'mates'
  end

  # Whether `viewer` may start a chat with the poster about this listing
  # (docs/spaces/wachuneed.md, Enquiries). Never the poster, never across a
  # block. Orbit is Mates plus their Mates (Account#orbit_of?), the same
  # ring as a post's reach.
  def messageable_by?(viewer)
    return false if viewer.nil? || viewer.id == account_id
    return false if account.blocking?(viewer) || viewer.blocking?(account)

    case message_reach
    when 'anyone' then true
    when 'orbit'  then viewer.mate?(account) || viewer.orbit_of?(account)
    else viewer.mate?(account)
    end
  end

  # A listing someone could still be writing about: up, or reserved.
  def open_for_enquiries?
    %w(live reserved).include?(state)
  end

  # The listing a chat with `poster` is being started about, when it is
  # theirs, still up, and its choice admits `sender`; nil otherwise. What
  # the Nudges gates ask when a non-Mate opens a chat or sends the first
  # message from "Message the poster": the listing opens that one door, not
  # general messaging.
  def self.enquiry_from(listing_id, sender:, poster:)
    return if listing_id.blank? || sender.nil? || poster.nil?

    listing = find_by(id: listing_id.to_s, account_id: poster.id)
    listing if listing&.open_for_enquiries? && listing.messageable_by?(sender)
  end

  private

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

  # Options are for something on offer; a wanted ad has nothing to choose.
  def drop_options_when_wanted
    self.options = [] if wanted? && options.present?
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
