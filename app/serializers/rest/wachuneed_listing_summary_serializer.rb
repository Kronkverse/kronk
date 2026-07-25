# frozen_string_literal: true

# Trimmed shape of a Listing for timeline embedding on the shared status,
# read by StatusWachuneedCard. The full listing detail lives at the
# martketplace API; this ships only what the feed card renders. Mirrors
# REST::BoothSetSummarySerializer / REST::ProposalSummarySerializer.
class REST::WachuneedListingSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :category, :subcategory,
             :price_display, :location, :state, :photo_url

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
end
