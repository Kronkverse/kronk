# frozen_string_literal: true

# Kollection app pages (docs/spaces/kollection.md, decisions.md 2026-11-24):
# an app's page reads like an app store listing, and is reached by its name
# (Kronk::NamedLink) rather than its number. Adds the listing's slug (filled
# for the apps already there), a tagline, who made it, a category, the
# platforms it runs on, a cover picture, and up to six screenshots in order.
class KollectionAppPages < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  # Pages of Kollection, not app names (KollectionApp.named_link_reserved).
  RESERVED = %w(composer settings).freeze

  class MigrationApp < ApplicationRecord
    self.table_name = 'kollection_apps'
  end

  def up
    add_column :kollection_apps, :slug, :string unless column_exists?(:kollection_apps, :slug)
    add_column :kollection_apps, :tagline, :string, null: false, default: '' unless column_exists?(:kollection_apps, :tagline)
    add_column :kollection_apps, :made_by, :string, null: false, default: '' unless column_exists?(:kollection_apps, :made_by)
    add_column :kollection_apps, :category, :string unless column_exists?(:kollection_apps, :category)
    add_column :kollection_apps, :platforms, :string, array: true, null: false, default: [] unless column_exists?(:kollection_apps, :platforms)
    # Its foreign key comes in the next migrations (strong_migrations).
    add_reference :kollection_apps, :cover_media_attachment, index: false unless column_exists?(:kollection_apps, :cover_media_attachment_id)

    unless table_exists?(:kollection_app_screenshots)
      create_table :kollection_app_screenshots do |t|
        t.references :kollection_app, null: false, foreign_key: { on_delete: :cascade }, index: false
        t.references :media_attachment, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
        t.integer :position, null: false, default: 0
        t.timestamps
      end
      add_index :kollection_app_screenshots, [:kollection_app_id, :position]
    end

    fill_slugs

    # A handful of rows, every one filled just above.
    safety_assured { change_column_null :kollection_apps, :slug, false }
    add_index :kollection_apps, :slug, unique: true, algorithm: :concurrently unless index_exists?(:kollection_apps, :slug)
  end

  def down
    drop_table :kollection_app_screenshots, if_exists: true
    remove_index :kollection_apps, :slug, if_exists: true
    %i(slug tagline made_by category platforms cover_media_attachment_id).each do |column|
      remove_column :kollection_apps, column, if_exists: true
    end
  end

  private

  def fill_slugs
    taken = MigrationApp.where.not(slug: nil).pluck(:slug).to_set
    MigrationApp.where(slug: nil).find_each do |app|
      base = app.name.to_s.parameterize.slice(0, 194).delete_suffix('-')
      base = 'kollection-app' if base.blank?
      candidate = base.match?(/\A\d+\z/) || RESERVED.include?(base) ? "#{base}-1" : base
      n = 1
      candidate = "#{base}-#{n += 1}" while taken.include?(candidate)
      taken << candidate
      app.update_columns(slug: candidate)
    end
  end
end
