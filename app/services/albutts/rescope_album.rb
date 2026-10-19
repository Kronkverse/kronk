# frozen_string_literal: true

# Albutts::RescopeAlbum — moves the posts an album already has (its card and
# every photo's post) to the album's new reach, after the reach has changed.
#
# Each post copied the album's reach when it was made, so without this a
# narrowed album would leave its photos as visible as before. When the reach
# narrows, the card also comes out of the home feeds of followers who can no
# longer see it; members of the album's Krews keep it. Photo posts never
# reach a feed (`kronk_feed_suppressed?`), so only the card needs that.
#
# Search keeps its old copy of the reach, which is harmless: every search hit
# goes back through the post's policy (Kronk::Search::PolicyFilter).
module Albutts
  class RescopeAlbum
    # Widest first.
    REACH_ORDER = %w(public orbit mates self_only).freeze

    def initialize(album, before:)
      @album = album
      @before = before.to_s
    end

    def call
      after = @album.visibility.to_s
      return if after == @before

      visibility = PublishAlbum::ALBUM_TO_STATUS_VISIBILITY.fetch(after)
      Status.where(id: @album.post_status_ids).update_all(visibility: Status.visibilities.fetch(visibility), updated_at: Time.current)

      unpush_card! if narrowed?(after)
    end

    private

    def narrowed?(after)
      REACH_ORDER.index(after) > REACH_ORDER.index(@before)
    end

    def unpush_card!
      card = @album.status&.reload
      return if card.nil?

      keep = KrewMembership.where(krew_id: @album.album_krews.select(:krew_id)).select(:account_id)
      card.account.followers_for_local_distribution.where.not(id: keep).reorder(nil).find_each do |follower|
        FeedManager.instance.unpush_from_home(follower, card) unless StatusPolicy.new(follower, card).show?
      end
    end
  end
end
