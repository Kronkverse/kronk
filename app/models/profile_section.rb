# frozen_string_literal: true

# A drawn shelf on an account's `/@:acct` profile — a stack of the
# account's own statuses, projected through a client-side render
# component keyed by `settings['render']`. Never stores copies of
# posts; the shelf carries a source binding + curation state and
# resolves at read via
# `Api::V1::Accounts::Profile::SectionsController#statuses`.
#
# The owner-authored ("told") side of the profile lives on
# `ProfileCard` — identity content (about / interests / values /
# etc.) with its own composer + endpoints. `ProfileSection` is
# post-projections only.
#
# `settings` (jsonb) carries:
#
#   render      client render component (album, track, trek, longform,
#               listing, photo, answers, moment, chips, korner, …).
#               Client-driven — new renders can land in a pure-frontend
#               PR; the backend only enforces non-blank.
#   korner_slug when the source binding is a korner (drives the query
#               and the client dispatch).
#   tag_name    when the source binding is a kategory tag.
#   order       ordering mode: 'newest' | 'oldest' | 'chosen'.
#   order_ids   ordered array of status ids when order == 'chosen'.
#   pins        ids to render first when order is 'newest' or 'oldest'.
#   hides       ids the owner has explicitly hidden from this shelf.
#
# Visibility uses the same five-scope ladder as `ProfileCard`
# (`everyone / kronk / connections / vouched / only_me`), so a card
# and a shelf published to the same audience have the same reach.
# Distinct from Album/Moment's four-tier reach ladder — profile
# surfaces speak the identity-scope vocabulary.
class ProfileSection < ApplicationRecord
  # `section_type` is `drawn` for every row today. Kept as a column
  # (rather than dropped) so a future told-shaped section — if the
  # split ever needs to change — can land without a schema shift.
  SECTION_KINDS = %w(drawn).freeze

  ORDER_MODES = %w(newest oldest chosen).freeze

  belongs_to :account, inverse_of: :profile_sections

  enum :visibility, {
    everyone: 0,
    kronk: 1,
    connections: 2,
    vouched: 3,
    only_me: 4,
  }, prefix: true

  validates :section_type, inclusion: { in: SECTION_KINDS }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate  :render_is_present
  validate  :order_is_valid

  scope :ordered, -> { order(:position) }
  scope :shown,   -> { where(visible: true) }

  # Legacy accessors kept as thin readers on `settings` so existing
  # callers don't break during the transition.
  def render_kind
    settings&.dig('render')
  end

  def korner_slug
    settings&.dig('korner_slug')
  end

  def tag_name
    settings&.dig('tag_name')
  end

  # Same rule ProfileCard.visible_to? uses — one shared ladder across
  # profile surfaces.
  def visible_to?(viewer)
    return true if visibility_everyone?
    return true if viewer && viewer.id == account_id

    case visibility
    when 'kronk'
      viewer&.local? && account.local?
    when 'connections'
      viewer && mutual_follow?(viewer)
    when 'vouched' # rubocop:disable Lint/DuplicateBranch
      # Vouched requires Anthemos. Until the membrane ships, fall back
      # to the connections gate — a slightly narrower audience than
      # the designed behaviour but never leaks content wider than
      # intended. Mirrors ProfileCard's fallback.
      viewer && mutual_follow?(viewer)
    else # only_me — already handled by the owner check above
      false
    end
  end

  private

  def render_is_present
    errors.add(:settings, 'shelf requires a render') if render_kind.blank?
  end

  def order_is_valid
    order = settings&.dig('order')
    errors.add(:settings, "unknown order (allowed: #{ORDER_MODES.join(', ')})") if order.present? && ORDER_MODES.exclude?(order)

    # `chosen` order needs an explicit id list — otherwise the render
    # would silently fall back to newest and confuse the owner.
    errors.add(:settings, 'chosen order requires order_ids') if order == 'chosen' && Array(settings&.dig('order_ids')).empty?
  end

  def mutual_follow?(viewer)
    Follow.exists?(account_id: account_id, target_account_id: viewer.id) &&
      Follow.exists?(account_id: viewer.id, target_account_id: account_id)
  end
end
