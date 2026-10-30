# frozen_string_literal: true

# The open list of First Nations Country names (docs/spaces/map.md, First
# Nations Country). Every name typed on a profile joins it, and anyone can add
# another name to a Country on the map; a steward takes a name off, which
# keeps it off. A name outlives whoever added it: the account is nulled, not
# cascaded, when they leave.
class CreateMapCountryNames < ActiveRecord::Migration[8.1]
  def change
    create_table :map_country_names do |t|
      t.string :name, limit: 60, null: false
      # The name folded for matching (case, accents, ŋ and spacing ignored).
      t.string :folded, limit: 60, null: false
      # The Country shape on the map it names, when someone has said which.
      t.integer :shape_id
      t.references :account, null: true, foreign_key: { on_delete: :nullify }
      t.datetime :removed_at
      t.references :removed_by_account, null: true, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.timestamps
    end

    add_index :map_country_names, :folded, unique: true
    add_index :map_country_names, :shape_id
  end
end
