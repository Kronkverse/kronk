# frozen_string_literal: true

# Albutts::Viewers — the people an album's owner chose to see it
# (docs/spaces/albutts.md, Who can see an album), kept together with the
# album's posts. Each post in it (its card, its photos, its "added photos"
# posts) has the same people added (`status_audience_grants`, the per-post
# audience of docs/spaces/feed.md), so they can open everything in it.
#
# Someone added is told, and gets the album's card in their home feed;
# someone taken off loses it unless they can still see it another way.
module Albutts
  class Viewers
    def initialize(album)
      @album = album
    end

    # Make the chosen people exactly `account_ids` (local accounts, not the
    # owner; none at all on a Kronkverse or Krew album). Returns the
    # accounts newly added, for `tell`.
    def sync!(account_ids)
      wanted = eligible_ids(account_ids)
      before = @album.album_viewers.pluck(:account_id)
      added = wanted - before
      removed = before - wanted
      return [] if added.empty? && removed.empty?

      @album.album_viewers.where(account_id: removed).delete_all
      added.each { |id| @album.album_viewers.create!(account_id: id) }
      @album.album_viewers.reset

      regrant_posts!
      feed!(added: added, removed: removed)
      Account.where(id: added).to_a
    end

    # Each one added is told the album was shared with them.
    def tell(accounts, by:)
      accounts.each do |account|
        Kronk::KornerEvents.publish(
          'albutts.album.shared',
          actor_account_id: by.id,
          recipient_account_id: account.id,
          album_id: @album.id
        )
      end
    end

    private

    def eligible_ids(account_ids)
      return [] unless @album.chooses_viewers?

      ids = Array(account_ids).map(&:to_i).reject(&:zero?).uniq - [@album.owner_id]
      Account.local.without_suspended.where(id: ids).pluck(:id)
    end

    # Every post in the album takes the album's people.
    def regrant_posts!
      Status.where(id: @album.post_status_ids).includes(:account).reorder(nil).find_each do |status|
        status.granted_accounts = Account.where(id: @album.post_audience_ids(status.account))
      end
    end

    # The album's card and its "added photos" posts. Photo posts never
    # reach a feed (`kronk_feed_suppressed?`).
    def feed!(added:, removed:)
      posts = Status.where(id: [@album.status_id, *@album.photo_batches.pluck(:status_id)].compact).to_a
      return if posts.empty?

      Account.where(id: added).includes(:user).find_each do |account|
        posts.each { |post| FeedManager.instance.push_to_home(account, post) }
      end
      Account.where(id: removed).includes(:user).find_each do |account|
        posts.each { |post| FeedManager.instance.unpush_from_home(account, post) unless StatusPolicy.new(account, post).show? }
      end
    end
  end
end
