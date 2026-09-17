# frozen_string_literal: true

# Feed projection (docs/kronk_feed_and_reach.md §3.2) — `source_korner` is the
# single discriminator on a Status: the korner slug whose content the Status
# projects (null = an ordinary post). It drives which feed card renders, the
# per-korner tune-in gate, and reach context — replacing the ad-hoc
# "which association is present" / `post_type == 'proposal'` checks.
#
# Backfills existing projected statuses from each korner's status_id link so
# the column is populated for content already in the timeline. New projections
# stamp it in their writers.
#
# The index is created CONCURRENTLY: a non-concurrent index on the large
# `statuses` table blocks writes (strong_migrations rejects it), and concurrent
# index creation requires disable_ddl_transaction!. The column/index existence
# guards plus the `source_korner IS NULL` backfill filter keep the whole
# migration idempotent and resumable if it is re-run after a partial failure.
class AddSourceKornerToStatuses < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  KORNER_TABLES = {
    'booth_sets' => 'booth',
    'proposals' => 'kommons',
    'events' => 'kalendar',
    'listings' => 'martketplace',
    'treks' => 'map',
  }.freeze

  def up
    add_column :statuses, :source_korner, :string unless column_exists?(:statuses, :source_korner)
    add_index :statuses, :source_korner, algorithm: :concurrently unless index_exists?(:statuses, :source_korner)

    # A bounded one-shot backfill (each korner's projected statuses, matched by
    # status_id); safe to run in-line. strong_migrations can't inspect a raw
    # execute, so assert safety explicitly.
    safety_assured do
      KORNER_TABLES.each do |table, slug|
        next unless table_exists?(table)

        execute(<<~SQL.squish)
          UPDATE statuses
          SET    source_korner = '#{slug}'
          FROM   #{table}
          WHERE  #{table}.status_id = statuses.id
            AND  statuses.source_korner IS NULL
        SQL
      end
    end
  end

  def down
    remove_column :statuses, :source_korner if column_exists?(:statuses, :source_korner)
  end
end
