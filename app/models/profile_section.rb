# frozen_string_literal: true

# One shelf on an account's `/@:acct` profile — the client copy calls
# these "shelves", the model keeps the old name so we don't churn code
# in a fresh direction that might still shift.
#
# Two kinds:
#
#   `told`   — owner-authored. The composer chooses a render shape
#              (block paragraphs, chips list, mini-cards rail…) at
#              write time; the shape lives in `settings.render` so a
#              new told-shape can land in a pure-frontend PR without
#              a schema change.
#
#   `drawn`  — computed from things this account has posted. Never
#              stores copies. Holds a source binding (`settings.render`
#              picks the client component; `settings.korner_slug` /
#              `settings.tag_name` bind to the source) plus per-viewer
#              curation state — an `order` mode, an ordered pin list,
#              and a hide list.
#
# Per-shelf visibility uses the same enum ladder as Album and Moment
# (`public / mates / krew / orbit / self_only`) so the platform's reach
# rules apply uniformly — a shelf marked `mates` shows the shelf
# header only to the owner's mates, though the individual posts inside
# a drawn shelf still enforce their own visibility on top.
class ProfileSection < ApplicationRecord
  SECTION_KINDS = %w(told drawn).freeze

  # `settings['render']` is a client-driven string. The backend
  # accepts anything non-blank so a new render can land without a
  # schema update. The client dispatches these to components today:
  #
  #   told:  block, chips, rail
  #   drawn: longform, album, track, trek, listing, photo, answers,
  #          moment, chips (kategory), korner (generic)
  #
  # Order modes for drawn shelves.
  ORDER_MODES = %w(newest oldest chosen).freeze

  # Cap on `settings['body']` for a told/block shelf. 2000 chars fits
  # an "About me" paragraph comfortably; anything longer belongs in a
  # long-form post that surfaces via a drawn shelf.
  TEXT_BODY_MAX = 2000

  belongs_to :account, inverse_of: :profile_sections

  enum :visibility,
       { public: 0, mates: 1, krew: 2, orbit: 3, self_only: 4 },
       suffix: :scope

  validates :section_type, inclusion: { in: SECTION_KINDS }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate  :render_is_present
  validate  :settings_match_kind

  scope :ordered, -> { order(:position) }
  scope :visible, -> { where(visible: true) }

  # Legacy accessors kept as thin readers on `settings` so existing
  # callers don't break during the transition. New code should read
  # `settings` directly or extend this list.
  def render_kind
    settings&.dig('render')
  end

  def korner_slug
    settings&.dig('korner_slug')
  end

  def tag_name
    settings&.dig('tag_name')
  end

  def body
    settings&.dig('body')
  end

  # Same rule Album uses — the owner always sees their own shelves;
  # for anyone else the enum decides. `nil` viewer = anonymous.
  def visible_to?(viewer)
    return true if viewer && viewer.id == account_id
    return false if self_only_scope?
    return true  if public_scope?
    return mates_visible_to?(viewer) if mates_scope?
    return orbit_visible_to?(viewer) if orbit_scope?
    return krew_visible_to?(viewer)  if krew_scope?

    false
  end

  private

  def render_is_present
    errors.add(:settings, 'shelf requires a render') if render_kind.blank?
  end

  def settings_match_kind
    case section_type
    when 'told'
      validate_told_shape
    when 'drawn'
      validate_drawn_shape
    end
  end

  def validate_told_shape
    case render_kind
    when 'block'
      if body.blank?
        errors.add(:settings, 'block shelf requires body')
      elsif body.length > TEXT_BODY_MAX
        errors.add(:settings, "body is too long (maximum is #{TEXT_BODY_MAX} characters)")
      end
    when 'chips'
      errors.add(:settings, 'chips shelf requires items') if Array(settings&.dig('items')).empty?
    when 'rail'
      errors.add(:settings, 'rail shelf requires cards') if Array(settings&.dig('cards')).empty?
    end
    # Any other told render lands as-is — new client renders are
    # allowed without a schema change.
  end

  def validate_drawn_shape
    order = settings&.dig('order')
    errors.add(:settings, "unknown order (allowed: #{ORDER_MODES.join(', ')})") if order.present? && ORDER_MODES.exclude?(order)

    # `chosen` order needs an explicit id list — otherwise the render
    # would silently fall back to newest and confuse the owner.
    errors.add(:settings, 'chosen order requires order_ids') if order == 'chosen' && Array(settings&.dig('order_ids')).empty?
  end

  def mates_visible_to?(viewer)
    return false if viewer.nil?

    viewer.mates.exists?(id: account_id) || viewer.id == account_id
  end

  def orbit_visible_to?(viewer)
    return false if viewer.nil?
    return true  if viewer.id == account_id
    return true  if viewer.mates.exists?(id: account_id)

    viewer.orbit_of?(account)
  end

  # Krew scoping needs an ownership signal for shelves that mirrors
  # Album's `album_krews` join. Deferred to a follow-up — MVP treats
  # a `krew`-scoped shelf as owner-only until the join lands.
  def krew_visible_to?(_viewer)
    false
  end
end
