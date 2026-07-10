# frozen_string_literal: true

# InFlow's daily update — sun/moon phase, seasonal context, whatever
# the korner's authors want to project. One row per day (enforced by
# unique index). Projected into the feed via status_id per §5.5;
# users tuned in to InFlow see the daily Kosmic card there.
class KosmicUpdate < ApplicationRecord
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :kosmic_update

  validates :on_date, presence: true, uniqueness: true
  validates :body,    presence: true

  scope :published,   -> { where.not(published_at: nil) }
  scope :unpublished, -> { where(published_at: nil) }
  scope :for_date,    ->(date) { where(on_date: date) }
  scope :recent,      -> { order(on_date: :desc) }

  def published?
    published_at.present?
  end
end
