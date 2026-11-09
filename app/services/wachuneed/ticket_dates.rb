# frozen_string_literal: true

# The dates of a ticketed listing, and a Kalendar event for each (Tal,
# 2026-11-09: tickets are a shop item that also makes linked Kalendar
# events). `sync` replaces the listing's dates with the rows given: a row
# with an `id` changes that date, one without adds a date, and a date left
# out goes, with its event, unless tickets for it have been accepted.
#
# Each event belongs to the seller, carries the listing's title, place and
# description, and is seen by whoever can see the listing: it gets a
# Status at the listing's reach, written quietly (no fan-out), since the
# listing's own feed card already announces it. It is Konnected to the
# listing.
class Wachuneed::TicketDates
  Invalid = Class.new(StandardError)

  def self.sync(listing, rows)
    new(listing).sync(rows)
  end

  def initialize(listing)
    @listing = listing
  end

  def sync(rows)
    rows = Array(rows).first(ListingTicketDate::MAX_PER_LISTING).map { |row| row.respond_to?(:to_unsafe_h) ? row.to_unsafe_h : row.to_h }.map(&:stringify_keys)
    kept_ids = rows.filter_map { |row| row['id'].presence&.to_i }

    ListingTicketDate.transaction do
      @listing.ticket_dates.where.not(id: kept_ids).each do |date| # rubocop:disable Rails/FindEach -- ordered association, at most 20
        raise Invalid, 'A date with accepted tickets cannot be removed' if date.seats_taken.positive?

        date.event&.destroy
        date.destroy!
      end

      rows.each do |row|
        date = row['id'].present? ? @listing.ticket_dates.find(row['id']) : @listing.ticket_dates.build
        date.assign_attributes(
          starts_at: row['starts_at'],
          ends_at: row['ends_at'].presence,
          place: row['place'].to_s.strip.first(200).presence,
          seats: @listing.ticket_url.present? ? nil : row['seats'].presence&.to_i
        )
        date.save!
        sync_event!(date)
      end
    end
    @listing.ticket_dates.reload
  end

  # The listing's title, reach or description changed: carry it to the
  # events.
  def refresh_events!
    @listing.ticket_dates.each { |date| sync_event!(date) }
  end

  private

  def sync_event!(date)
    event = date.event || Event.new(account: @listing.account)
    event.assign_attributes(
      title: @listing.title.first(200),
      description: @listing.description.to_s.first(5000),
      start_time: date.starts_at,
      end_time: date.ends_at,
      location_name: date.place
    )
    event.save!
    sync_status!(event)
    date.update!(event: event) if date.event_id != event.id
    link!(event)
  end

  def sync_status!(event)
    visibility = @listing.visibility.presence || 'public'
    if event.status
      event.status.update_columns(visibility: Status.visibilities.fetch(visibility), text: event.title, updated_at: Time.current)
    else
      status = Status.create!(account: @listing.account, text: event.title, visibility: visibility, source_korner: 'kalendar')
      event.update!(status: status)
    end
  end

  def link!(event)
    KornerAttachment.find_or_create_by!(source_slug: 'wachuneed', source_id: @listing.id, target_slug: 'kalendar', target_id: event.id,
                                        kind: 'link') do |link|
      link.created_by_account = @listing.account
    end
  end
end
