# frozen_string_literal: true

# A projekt's threshold (docs/spaces/freethedream.md, The threshold): it
# begins once at least so many people are in it and so many things on its
# checklists are sorted, and `begun_at` says when that first held.
class AddThresholdToFreethedreamProjects < ActiveRecord::Migration[8.0]
  def change
    add_column :freethedream_projects, :threshold_people, :integer
    add_column :freethedream_projects, :threshold_things, :integer
    add_column :freethedream_projects, :begun_at, :datetime
  end
end
