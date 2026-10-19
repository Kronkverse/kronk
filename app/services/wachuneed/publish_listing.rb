# frozen_string_literal: true

# Wachuneed::PublishListing — creates the companion Status that renders
# as the `wachuneed_card` in the feed (korner: wachuneed). Mirrors
# Albutts::PublishAlbum: called when a listing goes live, idempotent so a
# re-invocation is a no-op once the listing has a status_id.
#
# Without this a listing lived only on the /hub/wachuneed browse page —
# it never reached the timeline or the owner's profile, because nothing
# populated `listings.status_id` (the feed-projection link declared in
# config/korners/wachuneed.yaml → status_association: listing).
#
# The card renders from the `listing` association (Status.has_one :listing);
# `source_korner: 'wachuneed'` is the discriminator pickKornerCard uses
# to choose the card (docs/spaces/feed.md (How korners reach the feed)). The
# Status's visibility is the listing's reach (public / mates / orbit /
# self_only, the same words on both sides); `rescope` keeps it in step when
# the seller changes who can see the listing.
#
# Naming history: marketplace → wachuneed (2026-07-21) →
# mARTketplace/martketplace (2026-07-24) → wachuneed (2026-09-07).
module Wachuneed
  class PublishListing
    def initialize(listing)
      @listing = listing
    end

    def call
      return @listing if @listing.status_id.present?

      status = PostStatusService.new.call(
        @listing.account,
        text: @listing.title,
        visibility: @listing.visibility
      )

      @listing.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'wachuneed') # feed projection discriminator (§3.2)

      @listing
    end

    # Move the feed card to the listing's reach after it changed, and take it
    # out of the home feeds of Mates who can no longer see it (as
    # Albutts::RescopeAlbum does for an album's card).
    def rescope(before:)
      status = @listing.status
      return if status.nil? || status.visibility == @listing.visibility

      status.update_columns(visibility: Status.visibilities.fetch(@listing.visibility), updated_at: Time.current)
      return unless Albutts::RescopeAlbum::REACH_ORDER.index(@listing.visibility) > Albutts::RescopeAlbum::REACH_ORDER.index(before.to_s)

      status.account.followers_for_local_distribution.reorder(nil).find_each do |follower|
        FeedManager.instance.unpush_from_home(follower, status) unless StatusPolicy.new(follower, status).show?
      end
    end
  end
end
