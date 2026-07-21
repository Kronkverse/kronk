# frozen_string_literal: true

# Wachuneed slug rename (2026-07-21). The middle category of the
# creation/marketplace/service trio renamed to `goods` so the label no
# longer collides with the old korner name. Data-migrate any existing
# rows carrying the old value.
#
# `safety_assured` wraps the `execute` — strong_migrations blocks raw
# UPDATE otherwise. This is a scoped one-shot on a single non-indexed
# text column with no concurrent producers (Wachuneed has no UI yet),
# so the lock is inconsequential.
class RenameListingCategoryMarketplaceToGoods < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute "UPDATE listings SET category = 'goods' WHERE category = 'marketplace'"
    end
  end

  def down
    safety_assured do
      execute "UPDATE listings SET category = 'marketplace' WHERE category = 'goods'"
    end
  end
end
