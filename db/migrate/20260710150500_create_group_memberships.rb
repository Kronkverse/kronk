# frozen_string_literal: true

# Group membership rows. `role` is either 'seeder' (planted the group,
# multiple seeders permitted from creation — no monarchical control) or
# 'member'. Governance frameworks decide when structural changes require
# support from other seeders / members.
class CreateGroupMemberships < ActiveRecord::Migration[8.0]
  def change
    create_table :group_memberships do |t|
      t.references :group,   null: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string     :role, default: 'member', null: false
      t.datetime   :joined_at, null: false

      t.timestamps
    end

    add_index :group_memberships, [:group_id, :account_id], unique: true
    add_index :group_memberships, [:group_id, :role]
  end
end
