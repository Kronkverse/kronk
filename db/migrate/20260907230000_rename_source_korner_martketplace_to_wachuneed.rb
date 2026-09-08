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

  def up
    Status.where(source_korner: 'martketplace').in_batches(of: 1_000) do |batch|
      batch.update_all(source_korner: 'wachuneed')
    end
  end

  def down
    Status.where(source_korner: 'wachuneed').in_batches(of: 1_000) do |batch|
      batch.update_all(source_korner: 'martketplace')
    end
  end
end
