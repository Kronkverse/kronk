# frozen_string_literal: true

# Albutts::PublishPhoto — mints the Status that backs a single
# `AlbumPhoto`. The photo becomes a first-class post: caption goes on
# `Status#text` (so hashtag / mention parsing and edit history come
# for free), the uploaded media rides `ordered_media_attachments`,
# favourites are shared `Favourite` rows, replies thread through the
# standard `in_reply_to_id` chain. The photo row itself is now a thin
# join between album and status.
#
# The photo Status is created OUT-OF-CHANNEL (see `distributable?`
# override intent in AlbumPhoto): we don't want to blow up every
# member's home timeline with N status rows per album. `PostStatusService`
# handles the write; distribution is suppressed by keeping the album's
# feed-card as the only surface that a home feed sees (§Feed
# projection — one card per album, not per photo).
module Albutts
  class PublishPhoto
    # Photo captions inherit their audience from the album. Mapping is
    # explicit so a future rename on either side is caught by a spec.
    ALBUM_TO_STATUS_VISIBILITY = {
      'public' => 'public',
      'mates' => 'mates',
      'orbit' => 'orbit',
      'self_only' => 'self_only',
      'krew' => 'krew',
    }.freeze

    def initialize(album:, contributor:, media_attachment:, caption: nil)
      @album = album
      @contributor = contributor
      @media_attachment = media_attachment
      @caption = caption.to_s
    end

    def call
      status = PostStatusService.new.call(
        @contributor,
        text: @caption,
        visibility: ALBUM_TO_STATUS_VISIBILITY.fetch(@album.visibility, 'public'),
        media_ids: [@media_attachment.id]
      )
      status.update_column(:source_korner, 'albutts')
      attach_krews!(status) if @album.album_krews.exists?
      status
    end

    private

    def attach_krews!(status)
      krew_ids = @album.album_krews.pluck(:krew_id)
      return if krew_ids.empty?

      status.krews << Krew.where(id: krew_ids)
    end
  end
end
