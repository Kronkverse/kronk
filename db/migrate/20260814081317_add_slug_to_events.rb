# frozen_string_literal: true

# Kalendar — human-readable URLs (Tal 2026-08-14: "the page name for
# events is just a number, is that the best way for it?"). Events
# used to route by numeric id; from this migration onward every
# event has a URL-friendly slug generated from its title, with a
# numeric suffix if two events land on the same base slug ("cold
# plunge" → "cold-plunge" → "cold-plunge-2" for the next one).
#
# Migration shape:
#
# 1. Add the column NULLABLE so existing rows aren't broken.
# 2. Backfill by parameterising each existing event's title, applying
#    the same reserved-word + collision rules the model uses on
#    create, then writing the slug row-by-row so the unique index
#    can go on cleanly.
# 3. Add the unique index + NOT NULL constraint.
#
# `safety_assured` is used because the events table is small (the
# Kalendar rebuild is still in early adopter phase) and the backfill
# is a one-shot with obviously-bounded semantics.
class AddSlugToEvents < ActiveRecord::Migration[8.0]
  # Kept in-migration to avoid coupling the migration to future
  # changes in Event::RESERVED_SLUGS — this list is the one true at
  # the moment of backfill.
  RESERVED_SLUGS = %w(composer new list settings).freeze

  def up
    safety_assured do
      add_column :events, :slug, :string

      # Backfill every existing row before adding the unique index.
      # Reads and writes are within the schema migration so no other
      # writer is hitting the table.
      Event.reset_column_information
      taken = Set.new
      Event.order(:id).find_each do |event|
        base = event.title.to_s.parameterize
        base = 'event' if base.blank?
        candidate = base
        candidate = "#{base}-1" if RESERVED_SLUGS.include?(candidate)
        n = 1
        while taken.include?(candidate)
          n += 1
          candidate = "#{base}-#{n}"
        end
        taken << candidate
        event.update_column(:slug, candidate)
      end

      add_index :events, :slug, unique: true
      change_column_null :events, :slug, false
    end
  end

  def down
    remove_index :events, :slug
    remove_column :events, :slug
  end
end
