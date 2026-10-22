# frozen_string_literal: true

# Map's Places: an exact spot with a name and an address, the record a
# location Konnects to (docs/spaces/map.md, Places; decisions.md,
# 2026-10-23). A Place is a shared landmark, so it outlives its maker: the
# account is nulled, not cascaded, when they leave.
class CreateMapPlaces < ActiveRecord::Migration[8.1]
  def change
    create_table :map_places do |t|
      t.references :account, null: true, foreign_key: { on_delete: :nullify }
      t.string :name, limit: 120, null: false
      t.text :address
      t.decimal :latitude, precision: 9, scale: 6, null: false
      t.decimal :longitude, precision: 9, scale: 6, null: false
      t.timestamps
    end

    add_index :map_places, [:latitude, :longitude]
  end
end
