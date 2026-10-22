# frozen_string_literal: true

# A location is a Konnection to a Map Place now (decisions.md, 2026-10-23,
# "Map Places: location is a Konnection"). This gives every pinned event and
# kar a Place and links it there:
#
#   events.location_url (an OpenStreetMap pin) → Place, kalendar → map link
#   kars.location_lat / location_lng           → Place, karporn  → map link
#
# A Place is public (any member sees it), so only records everyone can
# already see are moved: an event posted to the Kronkverse, not invite-only
# and not to a Krew, and a kar posted to the Kronkverse. A Mates-only
# party's address doesn't become a landmark. The rest keep their pin in the
# old columns, which stay, until the composers move over.
#
# The same name at the same spot is one Place, so a venue used by many
# events is one landmark. Each link is made by the record's owner. A record
# already linked to a Place is skipped, so a re-run does nothing. Rolling
# back leaves the rows: they can't be told from Places people made.
class MoveLocationPinsIntoMapPlaces < ActiveRecord::Migration[8.1]
  class MigrationPlace < ApplicationRecord
    self.table_name = 'map_places'
  end

  class MigrationAttachment < ApplicationRecord
    self.table_name = 'korner_attachments'
  end

  PINNED_PLACE = 'Pinned place'
  PUBLIC = 0 # statuses.visibility and kars.visibility

  def up
    each_public_event { |id, account_id, name, url| move('kalendar', id, account_id, name, parse_osm_url(url)) }
    each_public_kar { |id, owner_id, label, lat, lng| move('karporn', id, owner_id, label, { lat: lat.to_f, lng: lng.to_f }) }
  end

  def down; end

  private

  def each_public_event(&block)
    select_rows(<<~SQL.squish).each(&block)
      SELECT e.id, e.account_id, e.location_name, e.location_url
      FROM events e
      INNER JOIN statuses s ON s.id = e.status_id
      WHERE e.location_url IS NOT NULL AND e.location_url <> ''
        AND e.invite_only = FALSE
        AND s.visibility = #{PUBLIC}
        AND NOT EXISTS (SELECT 1 FROM statuses_krews sk WHERE sk.status_id = s.id)
      ORDER BY e.id
    SQL
  end

  def each_public_kar(&block)
    select_rows(<<~SQL.squish).each(&block)
      SELECT k.id, k.owner_id, k.location_label, k.location_lat, k.location_lng
      FROM kars k
      WHERE k.location_lat IS NOT NULL AND k.location_lng IS NOT NULL
        AND k.visibility = #{PUBLIC}
      ORDER BY k.id
    SQL
  end

  def move(slug, id, account_id, label, coords)
    return unless coords && valid_coords?(coords)
    return if MigrationAttachment.exists?(source_slug: slug, source_id: id, target_slug: 'map')

    name = label.to_s.strip.presence&.truncate(120) || PINNED_PLACE
    place = MigrationPlace.find_or_create_by!(name: name, latitude: coords[:lat].round(6), longitude: coords[:lng].round(6)) do |p|
      p.address = label.to_s.strip.presence
      p.account_id = account_id
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
