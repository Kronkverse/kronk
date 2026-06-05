# frozen_string_literal: true

class WhatchuneedListing < ApplicationRecord
  CATEGORY_VALUES = %w(skills tools space transport food care knowledge other).freeze

  belongs_to :account
  has_many :whatchuneed_responses, foreign_key: :listing_id, dependent: :destroy, inverse_of: :listing

  enum :status, { open: 0, fulfilled: 1, closed: 2 }

  validates :title, presence: true, length: { maximum: 240 }
  validates :body,  presence: true, length: { maximum: 2000 }
  validates :category, inclusion: { in: CATEGORY_VALUES }, allow_nil: true

  scope :recent, -> { order(created_at: :desc) }
  scope :visible, -> { where(status: [:open, :fulfilled]) }

  def response_count
    whatchuneed_responses.count
  end
end
