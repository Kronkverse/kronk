# frozen_string_literal: true

# Map — event pins. Only *your* events: the ones you host, and the ones
# you've said you're going to or interested in (Tal, Kommons "Events on
# Map", 2026-10-27). Events with a parseable OSM `location_url`, and
# events with none that are Konnected to a Place (Kronk::RecordPlace: a
# location is a Konnection now), surface on the Map as spiral markers,
# filtered by the caller's visibility on the underlying Event (see
# `Event#visible_to?` and `Event.visible_to`). An event's own
# `location_url` wins over its Place. Tapping a pin opens a preview card
# with the essentials + a link to /kalendar/<slug>.
#
#   GET /api/v1/map/events — pins for my upcoming events, and ones on now
#   GET /api/v1/map/events?event=<slug> — the same, plus that one event
#       when I may see it: an event page's location link opens the Map on
#       its pin, whether or not I've answered it.
#
# Look-ahead is bounded to a rolling window so the payload stays
# small; the surface is a "what's coming" lens, not the full archive.
# Past events aren't rendered as pins by default — a historical lens
# is a separate feature.
class Api::V1::Map::EventsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }
  before_action :require_user!

  UPCOMING_WINDOW = 90.days
  # An event with no end time stays on the map this long after it starts.
  OPEN_ENDED = 3.hours
  MAX_PINS = 200
  MAX_SCANS = 5

  def index
    found = pinned_events
    going = EventRsvp.where(event_id: found.map { |event, _| event.id }, status: :going).group(:event_id).count

    render json: found.map { |event, coords| project(event, coords, going.fetch(event.id, 0)) }
  end

  private

  def candidate_events
    Event.where(upcoming_or_on)
         .order(:id)
         .not_cancelled
         .where(start_time: ..(Time.now.utc + UPCOMING_WINDOW))
         .where(pinned)
         .where(mine)
         .visible_to(current_account)
         .includes(:account, :status)
  end

  # Upcoming, or on right now (started and not yet over; one with no end
  # counts as on for OPEN_ENDED), so a pin stays while it's happening and
  # the map can show it as on now (docs/spaces/map.md, Events).
  def upcoming_or_on
    now = Time.now.utc
    events = Event.arel_table
    events[:start_time].gt(now)
                       .or(events[:start_time].lteq(now).and(events[:end_time].gt(now)))
                       .or(events[:end_time].eq(nil).and(events[:start_time].gt(now - OPEN_ENDED)))
  end

  # Hosted by me, or answered going / interested — plus the event the
  # page was opened for (`?event=`), if any.
  def mine
    answered = EventRsvp.where(account: current_account, status: %i(going interested)).select(:event_id)
    condition = Event.arel_table[:account_id].eq(current_account.id).or(Event.arel_table[:id].in(answered.arel))
    focus = focused_event_id
    focus ? condition.or(Event.arel_table[:id].eq(focus)) : condition
  end

  def focused_event_id
    return if params[:event].blank?

    Event.by_link!(params[:event].to_s).id
  rescue ActiveRecord::RecordNotFound
    nil
  end

  # An own `location_url`, or a Place Konnected by the event's host.
  def pinned
    url = Event.arel_table[:location_url]
    url.not_eq(nil).and(url.not_eq('')).or(Kronk::RecordPlace.konnected_condition(Event))
  end

  # `visible_to` (the scope) only handles invite-only; the event's own reach
  # (Mates, Orbit, Just me, a Krew) is checked per event, the same check
  # EventsController#show makes, and so is the location. Both drop rows
  # after the read, so read further pages, up to MAX_SCANS, until MAX_PINS
  # pins are found. Before, hidden and unmappable events used up the limit
  # and visible ones later in the window never got a pin.
  def pinned_events
    found = []

    MAX_SCANS.times do |page|
      batch = candidate_events.offset(page * MAX_PINS).limit(MAX_PINS).to_a
      Kronk::RecordPlace.preload(batch.select { |event| event.location_url.blank? })

      batch.each do |event|
        next unless event.visible_to?(current_account)

        coords = pin_for(event)
        found << [event, coords] if coords
        return found if found.size >= MAX_PINS
      end

      break if batch.size < MAX_PINS
    end

    found
  end

  # The event's own pin; or, with no `location_url`, its Place's point.
  def pin_for(event)
    return Kronk::OsmPin.parse(event.location_url) if event.location_url.present?

    place = event.konnected_place
    place && { lat: place.latitude.to_f, lng: place.longitude.to_f, zoom: nil }
  end

  def project(event, coords, going_count)
    {
      id: event.id.to_s,
      slug: event.slug,
      title: event.title,
      start_time: event.start_time.iso8601,
      end_time: event.end_time&.iso8601,
      location_name: event.effective_location_name,
      event_type: event.event_type,
      lat: coords[:lat],
      lng: coords[:lng],
      zoom: coords[:zoom],
      # The First Nations Country it is on (Kronk::FirstNationsCountries).
      country: Kronk::FirstNationsCountries.at(coords[:lat], coords[:lng]),
      host: {
        acct: event.account.acct,
        display_name: event.account.display_name.presence || event.account.username,
      },
      going_count: going_count,
    }
  end
end
