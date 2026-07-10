# frozen_string_literal: true

# Multi-group post targeting: one Status can address N groups; visible
# to members of any (union). See §Groups.4 in the spec.
class CreateStatusesGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :statuses_groups, id: false do |t|
      t.references :status, null: false, foreign_key: { on_delete: :cascade }
      t.references :group,  null: false, foreign_key: { on_delete: :cascade }
    end

    add_index :statuses_groups, [:status_id, :group_id], unique: true
    add_index :statuses_groups, :group_id
  end
end
