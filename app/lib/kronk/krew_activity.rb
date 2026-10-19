# frozen_string_literal: true

# What's happening in a Krew, for the top of its page (docs/spaces/krew.md,
# The surfaces): the last few things done in it, newest first. Nothing is
# stored for this; each kind is read from its own records.
#
# - photos: someone added photos to one of the Krew's albums, one line per
#   person, album and day ("Tomas added 37 photos to Mayhem 2026").
# - event: an event whose audience includes the Krew.
# - post: a post sent to the Krew. The posts behind an event or an album
#   are left out; they have their own line.
# - joined: someone joined the Krew.
#
# Only what the viewer could open is listed.
class Kronk::KrewActivity
  Line = Struct.new(:kind, :at, :account, :photo_count, :album, :event, :status, keyword_init: true)

  LIMIT = 3
  # How many recent records of each kind are read before the merge.
  SCAN = 10

  def initialize(krew, viewer)
    @krew = krew
    @viewer = viewer
  end

  def lines(limit: LIMIT)
    (photo_lines + event_lines + post_lines + joined_lines).sort_by { |line| -line.at.to_f }.first(limit)
  end

  private

  def album_ids
    @album_ids ||= Album.visible_to(@viewer).where(id: AlbumKrew.where(krew_id: @krew.id).select(:album_id)).pluck(:id)
  end

  def photo_lines
    return [] if album_ids.empty?

    day = Arel.sql("date_trunc('day', album_photos.created_at)")
    rows = AlbumPhoto.where(album_id: album_ids)
                     .group(:album_id, :contributor_id, day)
                     .order(Arel.sql('MAX(album_photos.created_at) DESC'))
                     .limit(SCAN)
                     .pluck(:album_id, :contributor_id, Arel.sql('COUNT(*)'), Arel.sql('MAX(album_photos.created_at)'))
    albums = Album.where(id: rows.map(&:first)).index_by(&:id)
    accounts = Account.without_suspended.where(id: rows.map(&:second)).index_by(&:id)

    rows.filter_map do |album_id, account_id, count, at|
      next unless accounts[account_id]

      Line.new(kind: 'photos', at: at, account: accounts[account_id], photo_count: count, album: albums[album_id])
    end
  end

  def event_lines
    Event.not_cancelled.root_events
         .where(status_id: @krew.statuses.select(:id))
         .includes(:account)
         .order(created_at: :desc)
         .limit(SCAN)
         .select { |event| event.visible_to?(@viewer) && !event.account.suspended? }
         .map { |event| Line.new(kind: 'event', at: event.created_at, account: event.account, event: event) }
  end

  def post_lines
    @krew.statuses
         .where.not(id: Event.where.not(status_id: nil).select(:status_id))
         .where.not(id: Album.where.not(status_id: nil).select(:status_id))
         .where.not(id: AlbumPhoto.where.not(status_id: nil).select(:status_id))
         .reorder(id: :desc)
         .includes(:account)
         .limit(SCAN)
         .select { |status| !status.account.suspended? && StatusPolicy.new(@viewer, status).show? }
         .map { |status| Line.new(kind: 'post', at: status.created_at, account: status.account, status: status) }
  end

  def joined_lines
    @krew.krew_memberships
         .joins(:account).merge(Account.without_suspended)
         .includes(:account)
         .order(joined_at: :desc)
         .limit(SCAN)
         .map { |membership| Line.new(kind: 'joined', at: membership.joined_at, account: membership.account) }
  end
end
