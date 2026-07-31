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
# (docs/kronk_feed_and_reach.md §2): the four-tier distance ladder
# (public/orbit/mates/self_only) or the orthogonal krew axis. For a
# krew-scoped album, the Status also gets attached to the album's
# krews via `statuses_krews` so the feed gate lands in the right
# krew timeline.
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

      status = PostStatusService.new.call(
        @album.owner,
        text: @album.title,
        visibility: ALBUM_TO_STATUS_VISIBILITY.fetch(@album.visibility, 'public')
      )

      attach_krews!(status) if @album.krew_scope?

      @album.update_columns(status_id: status.id)
      status.update_column(:source_korner, 'albutts') # feed projection discriminator (§3.2)

      @album
    end

    private

    def attach_krews!(status)
      krew_ids = @album.album_krews.pluck(:krew_id)
      return if krew_ids.empty?

      status.krews << Krew.where(id: krew_ids)
    end
  end
end
