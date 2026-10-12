# frozen_string_literal: true

# A comment in the short thread every project, part and item carries.
module Freethedream
  class Comment < ApplicationRecord
    self.table_name = 'freethedream_comments'

    BODY_MAX = 2000

    belongs_to :subject, polymorphic: true
    belongs_to :account

    validates :body, presence: true, length: { maximum: BODY_MAX }

    scope :oldest_first, -> { order(:created_at, :id) }
  end
end
