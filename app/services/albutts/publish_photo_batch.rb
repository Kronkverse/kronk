# frozen_string_literal: true

# Albutts::PublishPhotoBatch — one post in the feed for a burst of photos
# someone added to an album: "Ash added 20 photos to Mayhem 2026" (Tal,
# 2026-10-19; docs/spaces/albutts.md, Feed projection). The album's own card
# is posted once, when it is made, and each photo's post stays out of feeds,
# so without this nobody saw that an album had grown.
#
# A burst is the photos one person adds to one album with no gap of QUIET
# or more between them. Its post goes out once the burst has been quiet for
# QUIET, so twenty photos added over five minutes make one post. Photos the
# owner adds while making the album are already on its card, so they don't
# count. The post's reach and Krews are the album's.
module Albutts
  class PublishPhotoBatch
    QUIET = 10.minutes
    CREATION_WINDOW = 15.minutes

    # Every person's earlier bursts in every album, each as a post dated when
    # it happened (the backlog, 2026-10-19). Safe to run again: a photo that
    # already has a post is skipped.
    def self.backlog_all!(now: Time.current)
      AlbumPhoto.with_status.where(batch_id: nil).distinct.pluck(:album_id, :contributor_id).each do |album_id, account_id|
        album = Album.find_by(id: album_id)
        account = Account.find_by(id: account_id)
        next if album.nil? || account.nil? || account.suspended?

        new(album, account).backlog!(now: now)
      end
    end

    def initialize(album, account)
      @album = album
      @account = account
    end

    # This person's photos in the album that no post covers yet.
    def pending
      scope = @album.photos.with_status.where(contributor_id: @account.id, batch_id: nil)
      scope = scope.where(AlbumPhoto.arel_table[:created_at].gt(@album.created_at + CREATION_WINDOW)) if @album.owner_id == @account.id
      scope.order(:created_at, :id)
    end

    # Posts the burst now if it has gone quiet. Returns the batch, or nil.
    def call(now: Time.current)
      batch = AlbumPhotoBatch.transaction do
        @album.lock!
        photos = pending.to_a
        next if photos.empty? || photos.last.created_at > now - QUIET

        claim(photos)
      end
      # Posting happens outside the transaction: a post made inside one
      # misses home feeds (CLAUDE.md, Building a korner, "Two traps").
      publish!(batch) if batch
      batch
    end

    # Each past burst as its own post, dated when it happened. A burst still
    # going on is left for #call.
    def backlog!(now: Time.current)
      bursts(pending.to_a).each do |photos|
        next if photos.last.created_at > now - QUIET

        batch = AlbumPhotoBatch.transaction { claim(photos) }
        publish!(batch, at: photos.last.created_at)
      end
    end

    private

    def claim(photos)
      batch = AlbumPhotoBatch.create!(album: @album, account: @account)
      AlbumPhoto.where(id: photos.map(&:id)).update_all(batch_id: batch.id)
      batch
    end

    def bursts(photos)
      photos.slice_when { |earlier, later| later.created_at - earlier.created_at >= QUIET }.to_a
    end

    def publish!(batch, at: nil)
      text = I18n.t('albutts.photos_added', count: batch.photos.count, title: @album.title)
      visibility = PublishAlbum::ALBUM_TO_STATUS_VISIBILITY.fetch(@album.visibility.to_s, 'public')
      krew_ids = @album.album_krews.pluck(:krew_id)

      status = if at
                 backdated(text, visibility, at)
               else
                 PostStatusService.new.call(@account, text: text, visibility: visibility, krew_ids: krew_ids)
               end
      status.update_column(:source_korner, 'albutts')
      # The album's Krews, including any the person adding isn't in, as a
      # photo's own post has (PublishPhoto#attach_krews!).
      Kronk::StatusKrews.add(status.id, krew_ids)
      batch.update!(status: status)
      DistributionWorker.perform_async(status.id) if at
    end

    # A post for an earlier burst sits in feeds where the burst happened, not
    # at the top: its id is made from that time, as every post's is.
    def backdated(text, visibility, at)
      Status.create!(
        id: Mastodon::Snowflake.id_at(at),
        account: @account,
        text: text,
        visibility: visibility,
        local: true,
        created_at: at,
        updated_at: at
      )
    end
  end
end
