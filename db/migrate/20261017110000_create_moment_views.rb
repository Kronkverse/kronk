# frozen_string_literal: true

# Who has seen a Moment (docs/spaces/moments.md, Views). One row per viewer,
# written when the Moment comes on screen in the viewer; the owner sees the
# count and the list. `views_count` saves counting rows for every tile.
class CreateMomentViews < ActiveRecord::Migration[8.0]
  def change
    create_table :moment_views do |t|
      t.references :moment, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :created_at, null: false
    end

    add_index :moment_views, [:moment_id, :account_id], unique: true
    add_column :moments, :views_count, :integer, null: false, default: 0
  end
end
