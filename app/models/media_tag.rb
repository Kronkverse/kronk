# frozen_string_literal: true

class MediaTag < ApplicationRecord
  belongs_to :media_attachment
  belongs_to :account
  belongs_to :created_by_account, class_name: 'Account'

  validates :account_id, uniqueness: { scope: :media_attachment_id }
  validates :x, :y, numericality: { greater_than_or_equal_to: 0.0, less_than_or_equal_to: 1.0 }
end
