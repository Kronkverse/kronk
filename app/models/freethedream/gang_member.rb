# frozen_string_literal: true

# Someone who has joined a Komponent (a gang; people call it a Komponent,
# Tal 2026-10-30). Joining is how you hear about it: new talk in it and
# in its fractals, and things added to it (Freethedream::GangNudges).
# Only someone in the projekt can join, and a fractal is heard about
# through its Komponent.
module Freethedream
  class GangMember < ApplicationRecord
    self.table_name = 'freethedream_gang_members'

    belongs_to :project, class_name: 'Freethedream::Project'
    belongs_to :account

    validates :account_id, uniqueness: { scope: :project_id }
    validate :project_is_a_gang

    private

    def project_is_a_gang
      errors.add(:project_id, :invalid) unless project&.gang?
    end
  end
end
