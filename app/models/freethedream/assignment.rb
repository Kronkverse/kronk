# frozen_string_literal: true

# Someone a fractal is assigned to (Kommons "Fractals", 2026-11-22): a
# fractal is a piece of a Komponent's work, shown as its own checklist on
# the Komponent's page, and anyone in the projekt assigns it to people in
# the projekt.
module Freethedream
  class Assignment < ApplicationRecord
    self.table_name = 'freethedream_assignments'

    belongs_to :project, class_name: 'Freethedream::Project'
    belongs_to :account

    validates :account_id, uniqueness: { scope: :project_id }
    validate :project_is_a_fractal
    validate :account_is_in_the_projekt

    private

    def project_is_a_fractal
      errors.add(:project_id, :invalid) unless project&.fractal?
    end

    def account_is_in_the_projekt
      errors.add(:account_id, :invalid) unless project && account && project.top.member?(account)
    end
  end
end
