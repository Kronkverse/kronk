# frozen_string_literal: true

# Trimmed shape of a Listing for timeline embedding on the shared status,
# read by StatusWachuneedCard. The full listing detail lives at the
# wachuneed API; this ships only what the feed card renders. Mirrors
# REST::BoothSetSummarySerializer / REST::ProposalSummarySerializer.
class REST::WachuneedListingSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :category, :subcategory,
             :price_display, :location, :state, :photo_url, :photos, :kind,
             :shop_section_id

  # Detail endpoint only (`include_account: true`): the raw price so the
  # owner's edit form can prefill it, and the full-size photo for the
  # detail page (the card's :small variant is too soft at that size).
  attribute :price_cents, if: :detail?
  attribute :price_currency, if: :detail?
  attribute :photo_full_url, if: :detail?

  # The poster, for "Posted by" + "Message the poster" + the owner's Edit
  # button. The controller always asked for it (`include_account: true`)
  # but nothing here emitted it, so the detail page showed neither.
  belongs_to :account, serializer: REST::AccountSerializer, if: :detail?

  # Detail only: the seller's shop, for "See everything from this shop",
  # and whether the viewer may message them about it (their Mate, or the
  # shop takes enquiries from anyone).
  attribute :shop, if: :detail?
  attribute :can_message, if: :detail?

  def detail?
    instance_options[:include_account].present?
  end

  def shop_section_id
    object.listing_shop_section_id&.to_s
  end

  def shop
    shop = ListingShop.find_by(account_id: object.account_id)
    shop && { name: shop.name, acct: object.account.acct }
  end

  def can_message
    viewer = instance_options[:viewer]
    return false if viewer.nil? || viewer.id == object.account_id

    viewer.mate?(object.account) || ListingShop.enquiries_open?(object.account)
  end

  def id
    object.id.to_s
  end

  # Formatted price string for the card, or nil when free / by arrangement
  # (the card hides the price chip when absent). Kronk is Australia-native
  # so the fallback currency + display convention is AUD (A$25.00).
  def price_display
    return nil if object.free_or_by_arrangement?

    currency = object.price_currency.presence || 'AUD'
    symbol   = currency == 'AUD' ? 'A$' : "#{currency} "
    format('%<symbol>s%<amount>.2f', symbol: symbol, amount: object.price_cents.to_i / 100.0)
  end

  # The cover: the first photo's small variant, or nil if the listing has
  # none. Grid tiles use this; the card lays out around its absence.
  def photo_url
    photos.first&.dig(:url)
  end

  # Every photo in order, for the strip on the feed card and the listing
  # page, and for the edit form (which sends the ids back). `url` is the
  # small variant, `full_url` the original.
  def photos
    @photos ||= object.listing_photos.includes(:media_attachment).filter_map do |photo|
      media = photo.media_attachment
      next if media.nil?

      { id: media.id.to_s, url: media.file.url(:small), full_url: media.file.url(:original) }
    end
  end

  def photo_full_url
    photos.first&.dig(:full_url)
  end
end
