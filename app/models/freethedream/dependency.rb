# frozen_string_literal: true

# One part depending on another in the same project: Live Stage depends
# on Power.
module Freethedream
  class Dependency < ApplicationRecord
    self.table_name = 'freethedream_dependencies'

    belongs_to :project, class_name: 'Freethedream::Project'
    belongs_to :depends_on, class_name: 'Freethedream::Project'

    validates :depends_on_id, uniqueness: { scope: :project_id }
    validate :same_project
    validate :no_loop

    private

    def same_project
      return if project.nil? || depends_on.nil?

      errors.add(:depends_on_id, :invalid) if project_id == depends_on_id || project.top_id != depends_on.top_id
    end

    # Power can't depend on Live Stage if Live Stage depends on Power,
    # however far round the loop is.
    def no_loop
      return if project_id.nil? || depends_on_id.nil?

      edges = Dependency.where(project_id: Project.where(root_id: project.top_id).select(:id)).or(Dependency.where(project_id: project.top_id)).pluck(:project_id, :depends_on_id).group_by(&:first)
      seen = Set.new
      queue = [depends_on_id]
      until queue.empty?
        current = queue.shift
        next unless seen.add?(current)

        if current == project_id
          errors.add(:depends_on_id, :invalid)
          return
        end
        queue.concat((edges[current] || []).map(&:last))
      end
    end
  end
end
