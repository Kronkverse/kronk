# frozen_string_literal: true

# When someone last looked at a project's or section's talk. Talk newer
# than this, from someone else, is new to them.
module Freethedream
  class Read < ApplicationRecord
    self.table_name = 'freethedream_reads'

    belongs_to :project, class_name: 'Freethedream::Project'
    belongs_to :account

    def self.mark!(project, account)
      upsert({ project_id: project.id, account_id: account.id, seen_at: Time.current }, unique_by: [:account_id, :project_id])
    end
  end
end
