# frozen_string_literal: true

# One page of a feed read through Kronk's read-side filters (suppressed post
# types, Kommons proposals, the tune-in gate, the reach tier) without ending
# the feed early.
#
# The filters drop statuses after a page of `limit` has been read, so a page
# can come back short or empty: a big album's photos, a run of proposals, or
# — on the Me tier — twenty posts by other people. Mastodon only sends a next
# link for a non-empty page, and pages from the last status it returned, so
# one emptied page ended the feed (2026-10-11: Orbit stopping a few posts in,
# Me showing a single post).
#
# So keep reading until `limit` statuses survive or the source runs out, and
# page on the raw cursor rather than on the survivors.
class Kronk::FilteredFeedPage
  # Bounds one request to MAX_READS reads of `limit`. A page still short after
  # that carries a next link, so the client simply asks again.
  MAX_READS = 5

  attr_reader :statuses, :next_max_id, :prev_min_id

  # `read` is called with (max_id, since_id, min_id) and returns raw statuses
  # newest first; `filter` takes an array of them and returns the survivors,
  # order kept.
  def initialize(limit:, max_id:, since_id:, min_id:, read:, filter:)
    @limit    = limit
    @read     = read
    @filter   = filter
    @statuses = []

    if min_id.present?
      read_forward(max_id, min_id)
    else
      read_backward(max_id, since_id)
    end
  end

  # Whether anything was read at all — the pagination links hang on this, not
  # on whether anything survived the filters.
  def read_any?
    !@prev_min_id.nil?
  end

  private

  # Loading older posts: walk down until the page is full or the source ends.
  def read_backward(max_id, since_id)
    cursor = max_id

    MAX_READS.times do
      raw = @read.call(cursor, since_id, nil).to_a
      break if raw.empty?

      @prev_min_id ||= raw.first.id
      cursor = raw.last.id
      @statuses.concat(@filter.call(raw))
      break if @statuses.size >= @limit || raw.size < @limit
    end

    @next_max_id = cursor

    # Trimmed back to `limit`: the next page starts after the last one kept.
    return unless @statuses.size > @limit

    @statuses = @statuses.first(@limit)
    @next_max_id = @statuses.last.id
  end

  # Loading newer posts (min_id): one read. Walking upwards would mean
  # choosing which end of an overfull page to drop; the prev link carries on.
  def read_forward(max_id, min_id)
    raw = @read.call(max_id, nil, min_id).to_a
    return if raw.empty?

    @prev_min_id = raw.first.id
    @next_max_id = raw.last.id
    @statuses = @filter.call(raw)
  end
end
