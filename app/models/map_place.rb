# frozen_string_literal: true

# Map — a Place: an exact spot with a name and an address. It is Map's
# linkable record, the thing a location Konnects to (decisions.md,
# 2026-10-23, "Map Places: location is a Konnection"): an event, a kar or a
# listing links to the Place instead of carrying a location of its own.
#
# **A Place is seen by its maker, and by whoever can see something its
# maker Konnected it to.** It has no audience of its own: a Place its maker
# linked from their Mates-only party is seen by that party's Mates, one
# linked from a public event by every member, and one with no such
# Konnections by its maker alone. A link someone else makes to it doesn't
# widen it (decisions.md, 2026-10-27): a Mate who can see Alice's home
# can't open it to everyone by Konnecting a public record of theirs. A
# suspended or deleted maker's Places are seen by nobody. Its maker looks
# after it: they edit and delete it, and decide what it links out to.
# Anyone who can see it can Konnect their own things to it.
class MapPlace < ApplicationRecord
  include Kronk::AttachmentSource

  self.attachment_source_slug = 'map'

  NAME_MAX = 120
  ADDRESS_MAX = 500

  # How many Places a list reads before checking each one, so a crowded
  # map can't make one request check thousands.
  SCAN_LIMIT = 1000

  belongs_to :account, optional: true

  attr_writer :maker_konnections

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
  # with a Konnection their maker made (who is still here), whose other
  # ends `visible_to?` then checks one by one. It narrows what's read; it
  # doesn't decide.
  scope :made_or_konnected, lambda { |viewer|
    links = KornerAttachment.arel_table
    by_maker = KornerAttachment.where(links[:created_by_account_id].eq(arel_table[:account_id]))
    to_place = by_maker.where(target_slug: 'map').where(links[:target_id].eq(arel_table[:id])).arel.exists
    from_place = by_maker.where(source_slug: 'map').where(links[:source_id].eq(arel_table[:id])).arel.exists
    konnected = where(to_place).or(where(from_place)).where.not(account_id: Account.where.not(suspended_at: nil).select(:id))
    where(account_id: viewer.id).or(konnected)
  }

  # Up to `limit` of `scope`'s Places that `viewer` may see, in the scope's
  # order. Who sees a linked event or album (Mates, Orbit, a Krew, an
  # invite) has no SQL form, so this reads at most SCAN_LIMIT rows through
  # `made_or_konnected` and checks them with `select_visible`.
  def self.visible_among(scope, viewer, limit:)
    return [] if viewer.nil?

    select_visible(scope.merge(made_or_konnected(viewer)).limit(SCAN_LIMIT).to_a, viewer).first(limit)
  end

  # The `places` `viewer` may see, in order (preload_konnections first, so
  # the check costs a few queries for the list, not a few per Place).
  def self.select_visible(places, viewer)
    return [] if viewer.nil?

    preload_konnections(places).select { |place| place.visible_to?(viewer) }
  end

  # Fills each of `places` with its maker-made Konnections, and loads its
  # maker and the records at those links' other ends: one query for the
  # links and one per korner (KornerAttachment.preload_records).
  def self.preload_konnections(places)
    places = Array(places)
    return places if places.empty?

    ActiveRecord::Associations::Preloader.new(records: places, associations: :account).call
    links = konnections_by_place(places)
    KornerAttachment.preload_records(links.values.flatten)
    places.each { |place| place.maker_konnections = links.fetch(place.id, []) }
  end

  # The Konnections that count toward each of `places`' visibility, either
  # way, by Place id: only links its maker made.
  def self.konnections_by_place(places)
    makers = places.to_h { |place| [place.id, place.account_id] }.compact
    return {} if makers.empty?

    ids = makers.keys
    KornerAttachment.where(target_slug: 'map', target_id: ids)
                    .or(KornerAttachment.where(source_slug: 'map', source_id: ids))
                    .where(created_by_account_id: makers.values.uniq)
                    .group_by { |link| link.target_slug == 'map' ? link.target_id : link.source_id }
                    .to_h { |place_id, place_links| [place_id, place_links.select { |link| link.created_by_account_id == makers[place_id] }] }
  end

  # Its maker, or anyone who can see something its maker Konnected it to
  # (as Kronk::KornerRecords decides for that record's korner), while the
  # maker is still here.
  def visible_to?(viewer, links: nil)
    return false if viewer.nil?
    return true if account_id.present? && account_id == viewer.id
    return false if account.nil? || account.unavailable?

    links ||= maker_konnections
    links.any? do |link|
      other = link.target_slug == 'map' ? link.source_record : link.target_record
      !other.is_a?(MapPlace) && Kronk::KornerRecords.visible?(other, viewer)
    end
  end

  # The Konnections that count toward who sees it; preload_konnections
  # fills it for a list.
  def maker_konnections
    @maker_konnections ||= self.class.konnections_by_place([self]).fetch(id, [])
  end

  def reload(*)
    remove_instance_variable(:@maker_konnections) if defined?(@maker_konnections)
    super
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
