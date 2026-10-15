# frozen_string_literal: true

# Someone on an Actualise item (a job): one of its actualisers. Instant,
# and open-ended: any number can jump on board.
module Freethedream
  class Claim < ApplicationRecord
    self.table_name = 'freethedream_claims'

    belongs_to :item, class_name: 'Freethedream::Item'
    belongs_to :account

    validates :account_id, uniqueness: { scope: :item_id }
    validate :item_is_actualise, on: :create

    private

    def item_is_actualise
      errors.add(:item_id, :invalid) unless item&.job_kind?
    end
  end
end
