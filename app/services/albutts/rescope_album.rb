# frozen_string_literal: true

# Albutts::RescopeAlbum — moves the posts an album already has (its card and
# every photo's post) to the album's new reach, after the reach has changed.
#
# Each post copied the album's reach when it was made, so without this a
# narrowed album would leave its photos as visible as before. When the reach
# narrows, the card also comes out of the home feeds of followers who can no
# longer see it; members of the album's Krews keep it. So do its "added
# photos" posts. Photo posts never reach a feed (`kronk_feed_suppressed?`).
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

    # The album's card and its "added photos" posts.
    def unpush_card!
      keep = KrewMembership.where(krew_id: @album.album_krews.select(:krew_id)).select(:account_id)
      Status.where(id: [@album.status_id, *@album.photo_batches.pluck(:status_id)].compact).to_a.each do |post|
        post.account.followers_for_local_distribution.where.not(id: keep).reorder(nil).find_each do |follower|
          FeedManager.instance.unpush_from_home(follower, post) unless StatusPolicy.new(follower, post).show?
        end
      end
    end
  end
end
