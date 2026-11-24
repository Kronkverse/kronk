# frozen_string_literal: true

# Kollection (docs/spaces/kollection.md): the apps linked to Kronk. A row
# is the listing; when the app signs people in with Kronk it points at its
# Doorkeeper application, which has no owner, because the app belongs to
# Kronk rather than to the member who added it. That member is its keeper,
# and the keeper goes (nullify) without taking the app with them.
class CreateKollectionApps < ActiveRecord::Migration[8.1]
  def change
    create_table :kollection_apps do |t|
      t.string :name, null: false
      t.text :description, null: false, default: ''
      t.string :website
      t.references :keeper, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.references :oauth_application, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.references :icon_media_attachment, foreign_key: { to_table: :media_attachments, on_delete: :nullify }, index: false
      t.integer :status, null: false, default: 0
      t.datetime :pulled_at
      t.timestamps
    end
  end
end
