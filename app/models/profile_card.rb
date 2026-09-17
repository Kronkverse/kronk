# frozen_string_literal: true

# Identity content card on an account's /@user profile.
#
# Cards are the per-user "About me / Interests / Values / …" surfaces
# shown on the sectioned profile Me tab. They hold identity content —
# not statuses. (Post collections live on ProfileSection.)
#
# Every card carries a per-card visibility scope (the platform reach ladder:
# public / mates / orbit / self_only) so a user can share some identity
# content Kronkverse-wide and keep other cards private. See
# ProfileVisibility for the ladder semantics + the legacy-scope mapping.
class ProfileCard < ApplicationRecord
  include ProfileVisibility

  # Card types recognised by the frontend. Adding a new one here does
  # NOT automatically render it — the `profile_shelves` composer
  # decides which types the Library exposes and how each renders.
  # This list is validated to prevent arbitrary strings, so the
  # frontend has a bounded set to switch on.
  #
  # The block after `pod_credentials` is the structured-field catalog
  # (docs/spaces/profile.md "profile creator"): fields replace freeform
  # told cards — each is a card of one of these types, its answer in
  # `body`. profile_field_catalog.ts maps key -> label + answer type.
  CARD_TYPES = %w(
    about
    interests
    exploring
    personality
    drive
    rotation
    moments
    values
    note
    highlights
    at_a_glance
    open_to
    where_i_am
    pod_credentials

    pronouns
    location
    languages
    birthday
    star_sign
    height
    fun_fact
    favourite
    work_role
    skills
    status
    availability
    website
    collected_work
    other_profile
    timezone
    where_been
    home_base
  ).freeze

  # The three told-shape renders the composer offers.
  #
  #   block  — free-form paragraph (default). Uses `body` as-is.
  #   chips  — a list of short tag-style strings. Body is comma or
  #            newline separated; the client tokenises client-side.
  #   rail   — a horizontal rail of mini-cards, each `heading — text`.
  #            Body carries the whole rail as newline-separated pairs;
  #            the client parses. Keeping it in `body` avoids a schema
  #            branch per shape — every render still reads/writes one
  #            text field.
  #
  # New shapes can land in a pure-frontend PR — the backend accepts
  # any value here so long as it's on this list.
  RENDER_SHAPES = %w(block chips rail).freeze

  belongs_to :account, inverse_of: :profile_cards

  validates :card_type, presence: true, inclusion: { in: CARD_TYPES },
                        uniqueness: { scope: :account_id }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :body, length: { maximum: 4000 }
  validates :render, inclusion: { in: RENDER_SHAPES }
  validate  :tile_size_is_known

  # Tile sizes on the profile board (docs/spaces/profile.md). Stored in
  # `settings` rather than a column of its own so the next per-tile option
  # doesn't need another migration. Absent means "use the size derived from
  # what the tile holds", which is what an un-sized card gets.
  TILE_SIZES = %w(s m l xl).freeze

  def tile_size
    settings['size'].presence
  end

  scope :ordered, -> { order(:position) }
  scope :shown,   -> { where(visible: true) }

  private

  def tile_size_is_known
    return if tile_size.blank? || TILE_SIZES.include?(tile_size)

    errors.add(:settings, "unknown tile size (allowed: #{TILE_SIZES.join(', ')})")
  end
end
