# frozen_string_literal: true

# Martketplace::PublishListing — creates the companion Status that renders
# as the `wachuneed_card` in the feed (korner: martketplace). Mirrors
# Albutts::PublishAlbum: called when a listing goes live, idempotent so a
# re-invocation is a no-op once the listing has a status_id.
#
# Without this a listing lived only on the /hub/martketplace browse page —
# it never reached the timeline or the owner's profile, because nothing
# populated `listings.status_id` (the feed-projection link declared in
# config/korners/martketplace.yaml → status_association: listing).
#
# The card renders from the `listing` association (Status.has_one :listing);
# `source_korner: 'martketplace'` is the discriminator pickKornerCard uses
# to choose the card (docs/kronk_feed_and_reach.md §3.2). Listings have no
# per-item reach tier and are public marketplace items, so the Status is
# `public`.
module Martketplace
  class PublishListing
    def initialize(listing)
      @listing = listing
    end

    def call
      return @listing if @listing.status_id.present?

      status = PostStatusService.new.call(
        @listing.account,
        text: @listing.title,
        visibility: 'public'
      )

      @listing.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'martketplace') # feed projection discriminator (§3.2)

      @listing
    end
  end
end
