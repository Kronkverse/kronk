# frozen_string_literal: true

# Marketplace greenfield — reference korner built to spec §5 from day
# one. Uses `status_id` (§5.5 canonical linkage), snowflake IDs, and
# the spaces/marketplace/ media prefix per storage discipline.
class CreateListings < ActiveRecord::Migration[8.0]
  def change
    create_table :listings do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.bigint     :status_id
      t.string     :title, null: false, limit: 200
      t.text       :description
      t.string     :category, null: false           # creation | marketplace | service
      t.string     :subcategory
      t.integer    :price_cents                     # nil = free / by-arrangement
      t.string     :price_currency, limit: 3
      t.string     :location
      t.string     :state, default: 'draft', null: false # draft | live | reserved | closed
      t.datetime   :closed_at

      t.timestamps
    end

    add_index :listings, :status_id, unique: true, where: 'status_id IS NOT NULL'
    add_index :listings, :state
    add_index :listings, :category
    add_index :listings, :closed_at, where: 'closed_at IS NOT NULL'
  end
end
