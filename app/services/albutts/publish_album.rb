# frozen_string_literal: true

# Albutts::PublishAlbum — creates the companion Status that renders as
# the `albutts_card` in the feed. Called from AlbumsController#create;
# idempotent so a re-invocation is a no-op if the album already has a
# status_id.
#
# The spec (docs/spaces/albutts.md §Feed projection) says: **one card
# per album lifetime, not per photo**. So this fires only on album
# create — Slice 3's contribute publisher will emit an in-app event for
# fellow-contributor notifications, not a new feed card.
module Albutts
  class PublishAlbum
    def initialize(album)
      @album = album
    end

    def call
      return @album if @album.status_id.present?

      status = PostStatusService.new.call(
        @album.owner,
        text: @album.title,
        visibility: 'public'
      )

      @album.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'albutts') # feed projection discriminator (§3.2)

      @album
    end
  end
end
