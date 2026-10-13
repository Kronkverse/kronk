# frozen_string_literal: true

# A post made on someone else's profile (Tal 2026-10-06, Kommons proposal
# "Post to a profile"): the post stays its author's, and this names whose
# profile it was written on. Null for every ordinary post.
class AddProfileAccountToStatuses < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :statuses, :profile_account_id, :bigint, if_not_exists: true
    add_index :statuses, :profile_account_id, where: 'profile_account_id IS NOT NULL',
                                              algorithm: :concurrently, if_not_exists: true
  end

  def down
    remove_index :statuses, :profile_account_id, algorithm: :concurrently, if_exists: true
    remove_column :statuses, :profile_account_id, if_exists: true
  end
end
