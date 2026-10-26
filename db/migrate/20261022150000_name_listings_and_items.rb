# frozen_string_literal: true

# Wachuneed listings and FreeTheDream items get a slug from their title, like
# albums, events and emergences (Kronk::NamedLink, decisions.md 2026-10-22).
class NameListingsAndItems < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  class MigrationListing < ApplicationRecord
    self.table_name = 'listings'
  end

  class MigrationItem < ApplicationRecord
    self.table_name = 'freethedream_items'
  end

  def up
    add_column :listings, :slug, :string unless column_exists?(:listings, :slug)
    add_column :freethedream_items, :slug, :string unless column_exists?(:freethedream_items, :slug)

    fill(MigrationListing, 'listing')
    fill(MigrationItem, 'item')

    # A few hundred rows at most, and every one was just filled above, so
    # the NOT NULL scan is instant.
    safety_assured do
      change_column_null :listings, :slug, false
      change_column_null :freethedream_items, :slug, false
    end
    add_index :listings, :slug, unique: true, algorithm: :concurrently unless index_exists?(:listings, :slug)
    add_index :freethedream_items, :slug, unique: true, algorithm: :concurrently unless index_exists?(:freethedream_items, :slug)
  end

  def down
    remove_index :listings, :slug, if_exists: true
    remove_index :freethedream_items, :slug, if_exists: true
    remove_column :listings, :slug, if_exists: true
    remove_column :freethedream_items, :slug, if_exists: true
  end

  private

  def fill(model, fallback)
    taken = model.where.not(slug: nil).pluck(:slug).to_set
    model.where(slug: nil).find_each do |record|
      base = record.title.to_s.parameterize.slice(0, 194).delete_suffix('-')
      base = fallback if base.blank?
      candidate = base.match?(/\A\d+\z/) ? "#{base}-1" : base
      n = 1
      candidate = "#{base}-#{n += 1}" while taken.include?(candidate)
      taken << candidate
      record.update_columns(slug: candidate)
    end
  end
end
