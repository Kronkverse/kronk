# frozen_string_literal: true

# A slot taken on a job. Instant, until the job is full.
module Freethedream
  class Claim < ApplicationRecord
    self.table_name = 'freethedream_claims'

    belongs_to :item, class_name: 'Freethedream::Item'
    belongs_to :account

    validates :account_id, uniqueness: { scope: :item_id }
    validate :job_has_room, on: :create

    private

    def job_has_room
      return if item.nil?

      errors.add(:item_id, :invalid) unless item.job_kind?
      errors.add(:item_id, :full) if item.claims.count >= item.quantity
    end
  end
end
