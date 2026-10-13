# frozen_string_literal: true

# One line in a project's updates: a section added, something needed, someone
# bringing or claiming. Shown on the project and every section it happened
# in, so people can see what's changed without reading every thread.
module Freethedream
  class Activity < ApplicationRecord
    self.table_name = 'freethedream_activities'

    VERBS = %w(section_added need_added job_added idea_added offer_added bringing claimed taken_on done).freeze

    belongs_to :root, class_name: 'Freethedream::Project'
    belongs_to :project, class_name: 'Freethedream::Project'
    belongs_to :account, optional: true

    validates :verb, inclusion: { in: VERBS }

    scope :latest, -> { order(created_at: :desc, id: :desc) }

    def self.log!(project:, account:, verb:, item: nil, **data)
      create!(root_id: project.top_id, project: project, account: account, verb: verb, item_id: item&.id, data: data)
    end
  end
end
