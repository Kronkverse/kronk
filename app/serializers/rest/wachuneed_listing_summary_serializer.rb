# frozen_string_literal: true

# Trimmed shape of a Listing for timeline embedding on the shared status,
# read by StatusWachuneedCard. The full listing detail lives at the
# wachuneed API; this ships only what the feed card renders. Mirrors
# REST::BoothSetSummarySerializer / REST::ProposalSummarySerializer.
class REST::WachuneedListingSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :category, :subcategory,
             :price_display, :location, :state, :photo_url

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

  def detail?
    instance_options[:include_account].present?
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

  # First attached photo's full URL, or nil if the listing has none.
  # The card lays out around this — hidden gracefully when absent.
  def photo_url
    photo = object.listing_photos.order(:position).first
    photo&.media_attachment&.file&.url(:small)
  end

  def photo_full_url
    photo = object.listing_photos.order(:position).first
    photo&.media_attachment&.file&.url(:original)
  end
end
