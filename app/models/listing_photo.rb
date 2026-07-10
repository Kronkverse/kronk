# frozen_string_literal: true

class ListingPhoto < ApplicationRecord
  belongs_to :listing
  belongs_to :media_attachment

  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
