# frozen_string_literal: true

# One post in the feed for a burst of photos someone added to an album
# ("Ash added 20 photos to Mayhem 2026"; docs/spaces/albutts.md, Feed
# projection). The photos keep their own posts, which never reach a feed;
# this is the one that does. Albutts::PublishPhotoBatch makes them.
class AlbumPhotoBatch < ApplicationRecord
  belongs_to :album
  belongs_to :account
  belongs_to :status, optional: true, inverse_of: :album_photo_batch
  has_many :photos, class_name: 'AlbumPhoto', foreign_key: :batch_id, inverse_of: :batch, dependent: :nullify

  # Its post goes with it, out of every feed.
  before_destroy :remove_status!

  # The burst's photos still in the album, oldest first.
  def shown_photos
    photos.with_status.chronological
  end

  private

  def remove_status!
    RemovalWorker.perform_async(status_id) if status_id.present?
  end
end
