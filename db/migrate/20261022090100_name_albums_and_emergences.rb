# frozen_string_literal: true

# Albums and FreeTheDream projects get a slug from their title, like events
# already have (Kronk::NamedLink). Events whose slug is a bare number are
# renamed too: a number in the link is read as the id.
class NameAlbumsAndEmergences < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  class MigrationAlbum < ApplicationRecord
    self.table_name = 'albums'
  end

  class MigrationProject < ApplicationRecord
    self.table_name = 'freethedream_projects'
  end

  class MigrationEvent < ApplicationRecord
    self.table_name = 'events'
  end

  def up
    add_column :albums, :slug, :string unless column_exists?(:albums, :slug)
    add_column :freethedream_projects, :slug, :string unless column_exists?(:freethedream_projects, :slug)

    fill(MigrationAlbum, 'album')
    fill(MigrationProject, 'project')

    # A few hundred rows at most, and every one was just filled above, so
    # the NOT NULL scan is instant.
    safety_assured do
      change_column_null :albums, :slug, false
      change_column_null :freethedream_projects, :slug, false
    end
    add_index :albums, :slug, unique: true, algorithm: :concurrently unless index_exists?(:albums, :slug)
    add_index :freethedream_projects, :slug, unique: true, algorithm: :concurrently unless index_exists?(:freethedream_projects, :slug)

    MigrationEvent.where("slug ~ '^[0-9]+$'").find_each do |event|
      candidate = "#{event.slug}-1"
      n = 1
      candidate = "#{event.slug}-#{n += 1}" while MigrationEvent.exists?(slug: candidate)
      event.update_columns(slug: candidate)
    end
  end

  def down
    remove_index :albums, :slug, if_exists: true
    remove_index :freethedream_projects, :slug, if_exists: true
    remove_column :albums, :slug, if_exists: true
    remove_column :freethedream_projects, :slug, if_exists: true
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
