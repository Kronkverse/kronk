# frozen_string_literal: true

# Groups — a shareable multi-poster primitive at the framework level per
# §Groups. Not a korner; something korners CAN attach to (a Kalendar
# event's group, a Kommons proposal's group). Ships with the tables +
# models; the API, UI, and governance mechanics fill in during 2.x.
class CreateGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :groups do |t|
      t.string  :slug, null: false
      t.string  :name, null: false
      t.text    :description
      t.boolean :discoverable, default: false, null: false
      t.string  :governance_framework, default: 'peer_support', null: false
      t.integer :governance_threshold  # for :threshold governance; null otherwise
      t.datetime :archived_at

      t.timestamps
    end

    add_index :groups, :slug, unique: true
    add_index :groups, :discoverable, where: 'discoverable = true'
    add_index :groups, :archived_at, where: 'archived_at IS NOT NULL'
  end
end
