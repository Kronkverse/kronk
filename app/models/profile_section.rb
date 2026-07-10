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
#
# Type-specific configuration lives in `settings` (jsonb). Timeline
# sections have empty settings; korner sections carry korner_slug;
# kategory sections carry tag_name.
class ProfileSection < ApplicationRecord
  SECTION_TYPES = %w(timeline korner kategory).freeze

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

  private

  def settings_match_type
    case section_type
    when 'timeline'
      # timeline sections don't need config
    when 'korner'
      errors.add(:settings, 'korner section requires korner_slug') if korner_slug.blank?
    when 'kategory'
      errors.add(:settings, 'kategory section requires tag_name') if tag_name.blank?
    end
  end
end
