# frozen_string_literal: true

# Where a record is: the Map Place it is Konnected to (decisions.md,
# 2026-10-23, "Location fields become Konnect → Map"). Composers no longer
# have location fields; a record's location is a `link` to a Place, either
# way round. Whatever reads a location (an event's `location_name`, a kar's
# pin, a listing's `location`) falls back to this when the record's own old
# fields are empty, so old records and the Android app, which still writes
# them, keep working: own fields win.
#
# Only the owner's own Place, linked by them, counts (decisions.md,
# 2026-10-23 and 2026-10-27). Anyone who can see a record can't set where
# it is: a Place's maker may link their Place out to any record they can
# see, and that link Konnects the two, but it doesn't move the record. And
# a record's owner may Konnect someone else's Place, which shows in its
# Konnected section but isn't its location: the Place is read live, so its
# maker could otherwise move (or empty) the record's location by editing
# theirs, and the record would hand its own audience the address of a
# Place they can't otherwise see. A record → Place link is always its
# owner's (only an owner links from their record), a Place → record one
# only when the record's owner made it. With several, the oldest wins.
#
#   Kronk::RecordPlace.for(event)          # => MapPlace or nil
#   Kronk::RecordPlace.preload(events)     # two queries for a whole list
#   event.konnected_place                  # memoised; preload fills it
module Kronk
  module RecordPlace
    MAP = 'map'

    # The model side: `konnected_place`, memoised per record, which
    # `preload` fills for a list so a serializer reading it costs nothing.
    module Konnected
      extend ActiveSupport::Concern

      attr_writer :konnected_place

      def konnected_place
        return @konnected_place if defined?(@konnected_place)

        @konnected_place = Kronk::RecordPlace.for(self)
      end
    end

    module_function

    def for(record)
      return nil if record.nil? || record.id.nil?

      by_record([record]).fetch(record.id, nil)
    end

    # Fills `konnected_place` on each of `records` (all of one korner): one
    # query for the links, one for the Places.
    def preload(records)
      records = Array(records).compact
      return records if records.empty?

      places = by_record(records)
      records.each { |record| record.konnected_place = places[record.id] }
      records
    end

    # `{ record id => MapPlace }` for `records`, all of one korner.
    def by_record(records)
      records = Array(records).compact.select(&:id)
      return {} if records.empty?

      slug = records.first.class.attachment_source_slug
      owners = records.to_h { |record| [record.id, owner_id(record)] }
      ids = owners.keys

      scope = record_to_place(slug, ids).or(place_to_record(slug, ids)).where(kind: KornerAttachment::KIND_LINK)
      links = scope.order(:created_at, :id).pluck(:source_slug, :source_id, :target_id, :created_by_account_id)

      pairs = links.filter_map do |source_slug, source_id, target_id, made_by|
        record_id, place_id = source_slug == MAP ? [target_id, source_id] : [source_id, target_id]
        [record_id, place_id] if made_by.present? && made_by == owners[record_id]
      end
      return {} if pairs.empty?

      places = MapPlace.where(id: pairs.map(&:last).uniq).index_by(&:id)
      chosen = {}
      pairs.each do |record_id, place_id|
        place = places[place_id]
        next if chosen.key?(record_id) || place.nil? || place.account_id != owners[record_id]

        chosen[record_id] = place
      end
      chosen
    end

    # The SQL for "has a Place of its owner's that they Konnected", for
    # `model`'s table: an EXISTS over the links either way, with both owner
    # checks. For a scope that has to find records by their Place (the
    # Map's event pins).
    def konnected_condition(model)
      slug = model.attachment_source_slug
      table = model.arel_table
      links = KornerAttachment.arel_table
      places = MapPlace.arel_table
      owner = table[owner_column(model)]
      base = KornerAttachment.where(kind: KornerAttachment::KIND_LINK).where(links[:created_by_account_id].eq(owner))
      owners_place = ->(place_id) { MapPlace.where(places[:id].eq(place_id)).where(places[:account_id].eq(owner)).arel.exists }

      from_record = base.where(source_slug: slug, target_slug: MAP).where(links[:source_id].eq(table[:id])).where(owners_place.call(links[:target_id]))
      from_place = base.where(source_slug: MAP, target_slug: slug).where(links[:target_id].eq(table[:id])).where(owners_place.call(links[:source_id]))
      from_record.arel.exists.or(from_place.arel.exists)
    end

    # An OpenStreetMap link to the Place's point, in the `?mlat=&mlon=` shape
    # Kronk::OsmPin (and the client's parse_osm_url) read. Nil without one.
    def osm_url(place)
      return nil if place.nil? || place.latitude.nil? || place.longitude.nil?

      lat = format('%.6f', place.latitude.to_f)
      lng = format('%.6f', place.longitude.to_f)
      "https://www.openstreetmap.org/?mlat=#{lat}&mlon=#{lng}#map=16/#{lat}/#{lng}"
    end

    def record_to_place(slug, ids)
      KornerAttachment.where(source_slug: slug, source_id: ids, target_slug: MAP)
    end

    def place_to_record(slug, ids)
      KornerAttachment.where(source_slug: MAP, target_slug: slug, target_id: ids)
    end

    def owner_id(record)
      record.public_send(owner_column(record.class))
    end

    def owner_column(model)
      model.column_names.include?('owner_id') ? :owner_id : :account_id
    end

    private_class_method :record_to_place, :place_to_record, :owner_id, :owner_column
  end
end
