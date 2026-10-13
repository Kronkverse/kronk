# frozen_string_literal: true

# An inventory item shared into a project its owner is in. Only that
# project's members see it.
module Freethedream
  class Share < ApplicationRecord
    self.table_name = 'freethedream_shares'

    belongs_to :asset, class_name: 'Freethedream::Asset'
    belongs_to :project, class_name: 'Freethedream::Project'

    validates :project_id, uniqueness: { scope: :asset_id }
    validate :owner_is_in_project

    private

    def owner_is_in_project
      return if asset.nil? || project.nil?

      errors.add(:project_id, :invalid) unless project.top? && project.member?(asset.account)
    end
  end
end
