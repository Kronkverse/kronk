# frozen_string_literal: true

# Wachuneed slug rename (2026-07-21). The middle category of the
# creation/marketplace/service trio renamed to `goods` so the label no
# longer collides with the old korner name. Data-migrate any existing
# rows carrying the old value.
class RenameListingCategoryMarketplaceToGoods < ActiveRecord::Migration[8.0]
  def up
    execute "UPDATE listings SET category = 'goods' WHERE category = 'marketplace'"
  end

  def down
    execute "UPDATE listings SET category = 'marketplace' WHERE category = 'goods'"
  end
end
