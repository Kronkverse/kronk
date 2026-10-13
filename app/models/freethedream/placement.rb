# frozen_string_literal: true

# Where an item shows. One generator need can sit under Live Stage and
# Kitchen at once.
module Freethedream
  class Placement < ApplicationRecord
    self.table_name = 'freethedream_placements'

    belongs_to :item, class_name: 'Freethedream::Item'
    belongs_to :project, class_name: 'Freethedream::Project'

    validates :project_id, uniqueness: { scope: :item_id }
    validate :same_project

    private

    def same_project
      return if item.nil? || project.nil?

      errors.add(:project_id, :invalid) unless project.top_id == item.root_id
    end
  end
end
