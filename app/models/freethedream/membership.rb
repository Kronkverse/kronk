# frozen_string_literal: true

# Someone in a top-level FreeTheDream project, or asking to be.
module Freethedream
  class Membership < ApplicationRecord
    self.table_name = 'freethedream_memberships'

    belongs_to :project, class_name: 'Freethedream::Project'
    belongs_to :account

    enum :state, { member: 0, requested: 1 }

    validate :project_is_top_level

    private

    def project_is_top_level
      errors.add(:project_id, :invalid) unless project&.top?
    end
  end
end
