# frozen_string_literal: true

# Trimmed shape of a Listing for timeline embedding on the shared status,
# read by StatusWachuneedCard. The full listing detail lives at the
# wachuneed API; this ships only what the feed card renders. Mirrors
# REST::BoothSetSummarySerializer / REST::ProposalSummarySerializer.
class REST::WachuneedListingSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :category, :subcategory,
             :price_display, :location, :state

  def id
    object.id.to_s
  end

  # Formatted price string for the card, or nil when free / by arrangement
  # (the card hides the price chip when absent).
  def price_display
    return nil if object.free_or_by_arrangement?

    currency = object.price_currency.presence || 'USD'
    format('%<amount>.2f %<currency>s', amount: object.price_cents.to_i / 100.0, currency: currency)
  end
end
