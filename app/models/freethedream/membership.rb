# frozen_string_literal: true

# Someone in an emergence (a top-level FreeTheDream project), or asking to
# be. Being in it means being in its Krew: joining puts you in the Krew and
# leaving takes you out (KrewMembership does the same the other way).
module Freethedream
  class Membership < ApplicationRecord
    self.table_name = 'freethedream_memberships'

    belongs_to :project, class_name: 'Freethedream::Project'
    belongs_to :account

    # `requested` is no longer written: asking to join is a Krew join
    # request (Project#ask_to_join!). Old rows were moved there 2026-10-19.
    enum :state, { member: 0, requested: 1 }

    validate :project_is_top_level

    after_destroy :leave_krew, if: :member?
    after_save :join_krew, if: :member?

    private

    def join_krew
      krew = project.ensure_krew!
      return if krew.nil? || krew.krew_memberships.exists?(account_id: account_id)

      krew.krew_memberships.create!(account_id: account_id, role: account_id == project.owner_id ? 'seeder' : 'member', source: 'direct')
    end

    def leave_krew
      project.krew&.krew_memberships&.where(account_id: account_id)&.destroy_all
    end

    def project_is_top_level
      errors.add(:project_id, :invalid) unless project&.top?
    end
  end
end
