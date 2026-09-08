# frozen_string_literal: true

# Rename the `source_korner` value on existing Status rows that were
# projected while the korner slug was `martketplace` (2026-07-24 →
# 2026-09-07). The slug flips back to `wachuneed` today, and
# pickKornerCard uses `source_korner` verbatim to choose the feed
# projection — leaving stale rows would render them via the default
# StatusCard instead of `<StatusWachuneedCard>`.
#
# Cheap update-in-place — batched to keep the transaction small on
# large tables. No index change.
class RenameSourceKornerMartketplaceToWachuneed < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  # A bare class on the table, rather than `Status` itself. Two reasons, and
  # the second one bit:
  #
  #   1. A data migration should not depend on the app model, which is free to
  #      change under it long after this file is written.
  #   2. `Status` carries `default_scope { recent.kept }`, and `recent` is an
  #      order. `in_batches` on an ordered relation ignores that order — in
  #      production it does so silently, but `config.active_record.
  #      error_on_ignored_order` is true in test, so it raises there instead.
  #      That is why this migrated cleanly on shadow while the "one step
  #      migration" CI job failed on every pull request.
  #
  # The data was never at risk: `update_all` doesn't care what order it visits
  # rows in. Only the migration's ability to run in test was.
  class MigratedStatus < ApplicationRecord
    self.table_name = 'statuses'
  end

  def up
    MigratedStatus.where(source_korner: 'martketplace').in_batches(of: 1_000) do |batch|
      batch.update_all(source_korner: 'wachuneed')
    end
  end

  def down
    MigratedStatus.where(source_korner: 'wachuneed').in_batches(of: 1_000) do |batch|
      batch.update_all(source_korner: 'martketplace')
    end
  end
end
