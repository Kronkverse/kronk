# frozen_string_literal: true

class WhatchuneedResponse < ApplicationRecord
  belongs_to :listing, class_name: 'WhatchuneedListing', foreign_key: :listing_id, inverse_of: :whatchuneed_responses
  belongs_to :account

  validates :body, presence: true, length: { maximum: 1000 }
end
