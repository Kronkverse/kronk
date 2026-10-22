# frozen_string_literal: true

# Map — a Place: an exact spot with a name and an address. It is Map's
# linkable record, the thing a location Konnects to (decisions.md,
# 2026-10-23, "Map Places: location is a Konnection"): an event, a kar or a
# listing links to the Place instead of carrying a location of its own.
#
# **A Place is seen by whoever can see something Konnected to it, and its
# maker.** It has no audience of its own: a Place linked from a Mates-only
# party is seen by that party's Mates, one linked from a public event by
# every member, and one with no Konnections by its maker alone. Its maker
# looks after it: they edit and delete it, and decide what it links out
# to. Anyone who can see it can Konnect their own things to it.
class MapPlace < ApplicationRecord
  include Kronk::AttachmentSource

  self.attachment_source_slug = 'map'

  NAME_MAX = 120
  ADDRESS_MAX = 500

  # How many Places a list reads before checking each one, so a crowded
  # map can't make one request check thousands.
  SCAN_LIMIT = 1000

  belongs_to :account, optional: true

  validates :name, presence: true, length: { maximum: NAME_MAX }
  validates :address, length: { maximum: ADDRESS_MAX }, allow_blank: true
  validates :latitude, presence: true, numericality: { greater_than_or_equal_to: -90, less_than_or_equal_to: 90 }
  validates :longitude, presence: true, numericality: { greater_than_or_equal_to: -180, less_than_or_equal_to: 180 }

  normalizes :name, with: ->(value) { value.strip }
  normalizes :address, with: ->(value) { value.strip.presence }

  # Places inside a box. A box that crosses the antimeridian (west > east)
  # is the two boxes either side of it.
  scope :within, lambda { |south:, west:, north:, east:|
    lat = where(latitude: south..north)
    west <= east ? lat.where(longitude: west..east) : lat.where(longitude: west..).or(lat.where(longitude: ..east))
  }

  # A name or an address containing `query`.
  scope :matching, lambda { |query|
    pattern = "%#{sanitize_sql_like(query.to_s.strip)}%"
    where(arel_table[:name].matches(pattern)).or(where(arel_table[:address].matches(pattern)))
  }

  # The SQL half of who sees a Place: the ones `viewer` made, and the ones
  # with any Konnection at all, whose other ends `visible_to?` then checks
  # one by one. It narrows what's read; it doesn't decide.
  scope :made_or_konnected, lambda { |viewer|
    links = KornerAttachment.arel_table
    to_place = KornerAttachment.where(target_slug: 'map').where(links[:target_id].eq(arel_table[:id])).arel.exists
    from_place = KornerAttachment.where(source_slug: 'map').where(links[:source_id].eq(arel_table[:id])).arel.exists
    where(account_id: viewer.id).or(where(to_place)).or(where(from_place))
  }

  # Up to `limit` of `scope`'s Places that `viewer` may see, in the scope's
  # order. Who sees a linked event or album (Mates, Orbit, a Krew, an
  # invite) has no SQL form, so this reads at most SCAN_LIMIT rows through
  # `made_or_konnected`, loads all their Konnections in one query, and
  # checks each Place in Ruby.
  def self.visible_among(scope, viewer, limit:)
    return [] if viewer.nil?

    places = scope.merge(made_or_konnected(viewer)).limit(SCAN_LIMIT).to_a
    links = konnections_by_place(places.map(&:id))
    places.select { |place| place.visible_to?(viewer, links: links.fetch(place.id, [])) }.first(limit)
  end

  # Every Konnection of the Places `ids`, either way, by Place id.
  def self.konnections_by_place(ids)
    return {} if ids.empty?

    KornerAttachment.where(target_slug: 'map', target_id: ids)
                    .or(KornerAttachment.where(source_slug: 'map', source_id: ids))
                    .group_by { |link| link.target_slug == 'map' ? link.target_id : link.source_id }
  end

  # Its maker, or anyone who can see something Konnected to it (as
  # Kronk::KornerRecords decides for that record's korner).
  def visible_to?(viewer, links: nil)
    return false if viewer.nil?
    return true if account_id.present? && account_id == viewer.id

    links ||= self.class.konnections_by_place([id]).fetch(id, [])
    links.any? do |link|
      other = link.target_slug == 'map' ? link.source_record : link.target_record
      !other.is_a?(MapPlace) && Kronk::KornerRecords.visible?(other, viewer)
    end
  end

  # How the Konnect picker searches Places (`GET /api/v1/attachments/
  # candidates?korner=map`): by name or address, not name alone.
  def self.attachment_search(query)
    matching(query)
  end

  # The line under a Place's name in the Konnect picker.
  def attachment_subtitle
    address
  end
end
