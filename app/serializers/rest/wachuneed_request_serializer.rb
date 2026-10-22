# frozen_string_literal: true

# A request for a Wachuneed listing (ListingOffer), for the seller's and the
# buyer's lists of requests: what was asked, by whom, of which listing.
class REST::WachuneedRequestSerializer < ActiveModel::Serializer
  attributes :id, :state, :quantity, :choices, :total_cents, :price_currency,
             :message, :created_at, :responded_at, :listing

  belongs_to :offerer, key: :buyer, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  # Enough to show and link the listing, with its seller.
  def listing
    listing = object.listing
    cover   = listing.listing_photos.first&.media_attachment

    {
      id: listing.id.to_s,
      slug: listing.slug,
      title: listing.title,
      state: listing.state,
      cover_url: cover&.file&.url(:small),
      seller: REST::AccountSerializer.new(listing.account).as_json,
    }
  end
end
