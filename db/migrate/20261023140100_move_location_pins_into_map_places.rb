# frozen_string_literal: true

# A location is a Konnection to a Map Place now (decisions.md, 2026-10-23,
# "Map Places: location is a Konnection"). This gives every pinned event and
# kar a Place and links it there:
#
#   events.location_url (an OpenStreetMap pin) → Place, kalendar → map link
#   kars.location_lat / location_lng           → Place, karporn  → map link
#
# A Place is seen by whoever can see something Konnected to it, and its
# maker, so each Place has the audience of the record it came from: a
# Mates-only party's Place is seen by its Mates and nobody else. So every
# pinned record moves, whatever its reach.
#
# One owner's records with the same name at the same spot share a Place
# (their usual venue); different owners' records never do. The Place and
# the link are both made by the record's owner. A record already linked to
# a Place is skipped, so a re-run does nothing. The old columns stay.
# Rolling back leaves the rows: they can't be told from Places people made.
class MoveLocationPinsIntoMapPlaces < ActiveRecord::Migration[8.1]
  class MigrationPlace < ApplicationRecord
    self.table_name = 'map_places'
  end

  class MigrationAttachment < ApplicationRecord
    self.table_name = 'korner_attachments'
  end

  PINNED_PLACE = 'Pinned place'

  def up
    each_pinned_event { |id, account_id, name, url| move('kalendar', id, account_id, name, parse_osm_url(url)) }
    each_pinned_kar { |id, owner_id, label, lat, lng| move('karporn', id, owner_id, label, { lat: lat.to_f, lng: lng.to_f }) }
  end

  def down; end

  private

  def each_pinned_event(&block)
    select_rows(<<~SQL.squish).each(&block)
      SELECT e.id, e.account_id, e.location_name, e.location_url
      FROM events e
      WHERE e.location_url IS NOT NULL AND e.location_url <> ''
      ORDER BY e.id
    SQL
  end

  def each_pinned_kar(&block)
    select_rows(<<~SQL.squish).each(&block)
      SELECT k.id, k.owner_id, k.location_label, k.location_lat, k.location_lng
      FROM kars k
      WHERE k.location_lat IS NOT NULL AND k.location_lng IS NOT NULL
      ORDER BY k.id
    SQL
  end

  def move(slug, id, account_id, label, coords)
    return unless coords && valid_coords?(coords)
    return if MigrationAttachment.exists?(source_slug: slug, source_id: id, target_slug: 'map')

    name = label.to_s.strip.presence&.truncate(120) || PINNED_PLACE
    place = MigrationPlace.find_or_create_by!(account_id: account_id, name: name, latitude: coords[:lat].round(6), longitude: coords[:lng].round(6)) do |p|
      p.address = label.to_s.strip.presence
    end

    MigrationAttachment.create!(
      source_slug: slug, source_id: id, target_slug: 'map', target_id: place.id,
      kind: 'link', created_by_account_id: account_id
    )
  end

  def valid_coords?(coords)
    coords[:lat].finite? && coords[:lng].finite? && coords[:lat].between?(-90, 90) && coords[:lng].between?(-180, 180)
  end

  # The two shapes the event composer's pin picker writes (a frozen copy of
  # Kronk::OsmPin, so this migration doesn't move when that does):
  # `?mlat=<lat>&mlon=<lng>`, or `#map=<zoom>/<lat>/<lng>`.
  def parse_osm_url(raw)
    uri = URI.parse(raw.to_s)
    query = uri.query.to_s.split('&').filter_map { |kv| kv.split('=', 2) if kv.include?('=') }.to_h
    return { lat: query['mlat'].to_f, lng: query['mlon'].to_f } if query['mlat'].present? && query['mlon'].present?

    match = uri.fragment.to_s.match(%r{map=[\d.]+/(-?[\d.]+)/(-?[\d.]+)})
    match ? { lat: match[1].to_f, lng: match[2].to_f } : nil
  rescue URI::InvalidURIError
    nil
  end
end
