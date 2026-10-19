# frozen_string_literal: true

# Mycelium (Tal, 2026-10-19; docs/spaces/freethedream.md, Mycelium): the
# inventory becomes each person's Mycelium, and sharing something into an
# emergence is offering it there. So:
#
# - freethedream_assets becomes freethedream_mycelium_items, and an item's
#   asset_id its mycelium_item_id;
# - each share becomes an offer on its emergence, linked to the Mycelium
#   item, unless that item is already offered or brought there;
# - each one-off offer on its own (no need, no inventory item) becomes an
#   item in its owner's Mycelium, still offered where it was;
# - the shares table goes.
class GrowFreethedreamMycelium < ActiveRecord::Migration[8.0]
  OFFER = 3
  THINGS = 1

  def up
    # A handful of rows: FreeTheDream went live on 2026-10-13, and the app
    # deploys with the migration, so renaming in place is safe here.
    safety_assured do
      rename_table :freethedream_assets, :freethedream_mycelium_items
      rename_column :freethedream_items, :asset_id, :mycelium_item_id

      execute <<~SQL.squish
        WITH made AS (
          INSERT INTO freethedream_items (kind, title, category, quantity, owner_id, root_id, mycelium_item_id, created_at, updated_at)
          SELECT #{OFFER}, m.title, m.category, m.quantity, m.account_id, s.project_id, m.id, s.created_at, NOW()
          FROM freethedream_shares s
          JOIN freethedream_mycelium_items m ON m.id = s.asset_id
          WHERE NOT EXISTS (
            SELECT 1 FROM freethedream_items i
            WHERE i.mycelium_item_id = m.id AND i.root_id = s.project_id
          )
          RETURNING id, root_id
        )
        INSERT INTO freethedream_placements (item_id, project_id, created_at, updated_at)
        SELECT id, root_id, NOW(), NOW() FROM made
      SQL
    end

    lone = select_rows(<<~SQL.squish)
      SELECT id, owner_id, COALESCE(category, #{THINGS}), title, quantity FROM freethedream_items
      WHERE kind = #{OFFER} AND need_id IS NULL AND mycelium_item_id IS NULL AND owner_id IS NOT NULL
    SQL
    lone.each do |id, owner_id, category, title, quantity|
      grown = insert(<<~SQL.squish)
        INSERT INTO freethedream_mycelium_items (account_id, category, title, quantity, note, created_at, updated_at)
        VALUES (#{owner_id.to_i}, #{category.to_i}, #{connection.quote(title)}, #{quantity.to_i}, '', NOW(), NOW())
      SQL
      update "UPDATE freethedream_items SET mycelium_item_id = #{grown.to_i}, category = #{category.to_i} WHERE id = #{id.to_i}"
    end

    safety_assured { drop_table :freethedream_shares }
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
