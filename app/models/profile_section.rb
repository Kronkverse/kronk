# frozen_string_literal: true

# One section on an account's /@user profile. Ordered by `position`
# (0-indexed). `section_type` decides what the section renders:
#
#   'timeline'   → the account's chronological statuses. The default;
#                   every account has exactly one on signup.
#   'korner'     → statuses filtered by their korner projection
#                   (settings['korner_slug'] names which).
#   'kategory'   → statuses filtered by a curated Tag
#                   (settings['tag_name'] names which).
#   'text'       → owner-authored free-form text tile. The composer
#                   uses `title` for the heading ("About me",
#                   "Interests", "Passions", "Music I love", etc.)
#                   and `settings['body']` for the paragraph. Kept
#                   deliberately generic so a single type absorbs
#                   every "here's a thing I want to say about myself"
#                   affordance the UI decides to expose.
#
# Type-specific configuration lives in `settings` (jsonb). Timeline
# sections have empty settings; korner sections carry korner_slug;
# kategory sections carry tag_name; text sections carry body.
class ProfileSection < ApplicationRecord
  SECTION_TYPES = %w(timeline korner kategory text).freeze

  # Cap on `settings['body']` for a text tile. 2000 chars fits an
  # "About me" paragraph comfortably; anything longer belongs in a
  # long-form post that surfaces via a korner/timeline section.
  TEXT_BODY_MAX = 2000

  belongs_to :account, inverse_of: :profile_sections

  validates :section_type, inclusion: { in: SECTION_TYPES }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate  :settings_match_type

  scope :ordered, -> { order(:position) }
  scope :visible, -> { where(visible: true) }

  def korner_slug
    settings&.dig('korner_slug')
  end

  def tag_name
    settings&.dig('tag_name')
  end

  def body
    settings&.dig('body')
  end

  private

  def settings_match_type
    case section_type
    when 'timeline'
      # timeline sections don't need config
    when 'korner'
      errors.add(:settings, 'korner section requires korner_slug') if korner_slug.blank?
    when 'kategory'
      errors.add(:settings, 'kategory section requires tag_name') if tag_name.blank?
    when 'text'
      # `body` is required but the exact length rule sits alongside it
      # so a too-long body reads as one clear error, not two.
      if body.blank?
        errors.add(:settings, 'text section requires body')
      elsif body.length > TEXT_BODY_MAX
        errors.add(:settings, "body is too long (maximum is #{TEXT_BODY_MAX} characters)")
      end
    end
  end
end
