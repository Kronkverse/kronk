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
#
# The Status's `visibility` mirrors the album's reach tier
# (docs/spaces/feed.md (The reach ladder)): the four-tier distance ladder
# (public/orbit/mates/self_only) or the orthogonal krew axis. For a
# krew-scoped album, the Status is posted with the album's krews
# (statuses_krews) so the feed gate lands in the right krew timeline.
module Albutts
  class PublishAlbum
    # Maps Album visibility scopes → Status visibility. Same names in
    # both enums; the mapping is explicit so a future rename on either
    # side is caught by a spec instead of drifting silently.
    ALBUM_TO_STATUS_VISIBILITY = {
      'public' => 'public',
      'mates' => 'mates',
      'orbit' => 'orbit',
      'self_only' => 'self_only',
      'krew' => 'krew',
    }.freeze

    def initialize(album)
      @album = album
    end

    def call
      return @album if @album.status_id.present?

      # Krews go in with the post, so the fan-out (queued inside the call)
      # already knows them; attaching afterwards raced it and Krew members
      # could miss the album. PostStatusService keeps only Krews the owner is in.
      status = PostStatusService.new.call(
        @album.owner,
        text: @album.title,
        visibility: ALBUM_TO_STATUS_VISIBILITY.fetch(@album.visibility, 'public'),
        krew_ids: @album.album_krews.pluck(:krew_id)
      )

      @album.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'albutts') # feed projection discriminator (§3.2)

      @album
    end
  end
end
