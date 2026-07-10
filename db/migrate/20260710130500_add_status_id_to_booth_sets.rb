# frozen_string_literal: true

# Booth's canonical Status linkage per spec §5.5. Mirrors the treatment
# for proposals: adds `status_id`, backfills from the pre-2.0.0
# `shared_status_id`, keeps the old column for one release as a
# deprecated alias, then drops it in 2.1.
class AddStatusIdToBoothSets < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :booth_sets, :status_id, :bigint, if_not_exists: true

    safety_assured do
      execute <<~SQL.squish
        UPDATE booth_sets
        SET status_id = shared_status_id
        WHERE shared_status_id IS NOT NULL
          AND status_id IS NULL
      SQL
    end

    add_index :booth_sets,
              :status_id,
              unique: true,
              algorithm: :concurrently,
              where: 'status_id IS NOT NULL',
              if_not_exists: true
  end

  def down
    remove_index :booth_sets, :status_id, algorithm: :concurrently, if_exists: true
    remove_column :booth_sets, :status_id, if_exists: true
  end
end
