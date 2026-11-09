# frozen_string_literal: true

# A projekt's spaces, turned on from Konnect, and the order its page shows
# them in (docs/spaces/freethedream.md, A projekt's spaces).
class AddSpacesToFreethedreamProjects < ActiveRecord::Migration[8.1]
  def change
    add_column :freethedream_projects, :spaces, :string, array: true, default: [], null: false
    add_column :freethedream_projects, :section_order, :string, array: true, default: [], null: false
  end
end
