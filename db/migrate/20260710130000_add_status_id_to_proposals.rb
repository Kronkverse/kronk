# frozen_string_literal: true

# Kommons canonicalises its Status linkage under the spec §5.5 rule that
# every korner primary table uses `status_id`. `proposals` currently
# carries `discussion_status_id`; this migration adds `status_id` as
# the canonical column, backfills from the existing values, and adds
# the same unique/index constraints. The old `discussion_status_id`
# column stays for one release as a deprecated alias, then drops in 2.1.
class AddStatusIdToProposals < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :proposals, :status_id, :bigint, if_not_exists: true

    # Strong_migrations can't inspect a raw execute; the UPDATE is
    # writing a bigint we just added, so it's safe.
    safety_assured do
      execute <<~SQL.squish
        UPDATE proposals
        SET status_id = discussion_status_id
        WHERE discussion_status_id IS NOT NULL
          AND status_id IS NULL
      SQL
    end

    add_index :proposals, :status_id,
              unique: true,
              algorithm: :concurrently,
              where: 'status_id IS NOT NULL',
              if_not_exists: true
  end

  def down
    remove_index :proposals, :status_id, algorithm: :concurrently, if_exists: true
    remove_column :proposals, :status_id, if_exists: true
  end
end
