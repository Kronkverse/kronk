# frozen_string_literal: true

# Map — event pins. Events with a parseable OSM `location_url` surface
# on the Map as spiral markers, filtered by the caller's visibility on
# the underlying Event (see `Event#visible_to?` and
# `Event.visible_to`). Tapping a pin opens a preview card with the
# essentials + a link to /kalendar/<slug>.
#
#   GET /api/v1/map/events — pins for upcoming events I can see
#
# Look-ahead is bounded to a rolling window so the payload stays
# small; the surface is a "what's coming" lens, not the full archive.
# Past events aren't rendered as pins by default — a historical lens
# is a separate feature.
class Api::V1::Map::EventsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }
  before_action :require_user!

  UPCOMING_WINDOW = 90.days
  MAX_PINS = 200
  MAX_SCANS = 5

  def index
    found = pinned_events
    going = EventRsvp.where(event_id: found.map { |event, _| event.id }, status: :going).group(:event_id).count

    render json: found.map { |event, coords| project(event, coords, going.fetch(event.id, 0)) }
  end

  private

  def candidate_events
    Event.upcoming
         .order(:id)
         .not_cancelled
         .where(start_time: ..(Time.now.utc + UPCOMING_WINDOW))
         .where.not(location_url: [nil, ''])
         .visible_to(current_account)
         .includes(:account, :status)
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

      batch.each do |event|
        next unless event.visible_to?(current_account)

        coords = Kronk::OsmPin.parse(event.location_url)
        found << [event, coords] if coords
        return found if found.size >= MAX_PINS
      end

      break if batch.size < MAX_PINS
    end

    found
  end

  def project(event, coords, going_count)
    {
      id: event.id.to_s,
      slug: event.slug,
      title: event.title,
      start_time: event.start_time.iso8601,
      end_time: event.end_time&.iso8601,
      location_name: event.location_name,
      event_type: event.event_type,
      lat: coords[:lat],
      lng: coords[:lng],
      zoom: coords[:zoom],
      host: {
        acct: event.account.acct,
        display_name: event.account.display_name.presence || event.account.username,
      },
      going_count: going_count,
    }
  end
end
