# frozen_string_literal: true

# Karporn — a single car post: title + description + year/make/model +
# optional location tag + one or more photos. Single-author (all photos
# by the piece's owner). Krew scoping isn't offered in v1; the four
# reach tiers are the whole visibility axis.
class Kar < ApplicationRecord
  include Reachable

  belongs_to :owner, class_name: 'Account'
  belongs_to :cover_media_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :status, optional: true, inverse_of: :kar

  has_many :photos, class_name: 'KarPhoto', dependent: :destroy, inverse_of: :kar

  # Reach ladder. Krew is not offered on Karporn in v1.
  enum :visibility,
       { public: 0, mates: 1, orbit: 3, self_only: 4 },
       suffix: :scope

  validates :title, presence: true, length: { maximum: 240 }
  validates :description, length: { maximum: 4000 }, allow_blank: true
  validates :make, presence: true, length: { maximum: 120 }
  validates :model, presence: true, length: { maximum: 120 }
  # 1885 = Benz Patent-Motorwagen; +2 buys a bit of headroom for MY
  # concept cars posted before the model year rolls around.
  validates :year,
            presence: true,
            numericality: { only_integer: true, greater_than_or_equal_to: 1885, less_than_or_equal_to: -> { Time.current.year + 2 } }
  validates :location_label, length: { maximum: 240 }, allow_blank: true
  # Lat/lng have to arrive together; a bare lat or lng is a client bug.
  validate :location_coords_are_paired

  scope :recent, -> { order(created_at: :desc) }

  def location?
    location_lat.present? && location_lng.present?
  end

  # Reachable adapter — reach visibility lives in the concern.
  def self.reachable_owner_column
    :owner_id
  end

  def self.reachable_krew_scope(_krew_ids)
    none
  end

  private

  def reachable_owner_id
    owner_id
  end

  def reachable_owner
    owner
  end

  def reachable_krew_member?(_viewer)
    false
  end

  def location_coords_are_paired
    return if location_lat.blank? && location_lng.blank?
    return if location_lat.present? && location_lng.present?

    errors.add(:base, 'location_lat and location_lng must be provided together')
  end
end
