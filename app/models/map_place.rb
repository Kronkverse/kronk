# frozen_string_literal: true

# Map — a Place: an exact spot with a name and an address. It is Map's
# linkable record, the thing a location Konnects to (decisions.md,
# 2026-10-23, "Map Places: location is a Konnection"): an event, a kar or a
# listing links to the Place instead of carrying a location of its own.
#
# A Place is a shared landmark. Every signed-in member sees every Place; it
# says where something is, never who is there (that is presence, which
# stays out of attaching). Whoever made it looks after it: they edit and
# delete it, and decide what it links out to. Anyone Konnects their own
# things to it.
class MapPlace < ApplicationRecord
  include Kronk::AttachmentSource

  self.attachment_source_slug = 'map'

  NAME_MAX = 120
  ADDRESS_MAX = 500

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

  # Every member sees every Place (a landmark, not a person's whereabouts).
  scope :visible_to, ->(_viewer) { all }

  def visible_to?(viewer)
    viewer.present?
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
