# frozen_string_literal: true

# Krews Phase 2 — align the Ruby / SQL surface with the vocabulary the
# app already speaks. The URL and manifest slug flipped in Phase 1
# (2.0.0-alpha.203); this migration flips the tables underneath so the
# `Group` model class + `groups` table stop being the only place
# "groups" still leaks through.
#
# Renames:
#   groups             → krews
#   group_memberships  → krew_memberships   (group_id  → krew_id)
#   statuses_groups    → statuses_krews     (group_id  → krew_id)
#
# `nudges_conversations.krew_id` was already named for the destination
# but has an FK pointing at `groups`. rename_table updates the FK
# target automatically in PostgreSQL, so we don't touch it here.
#
# Rails' `rename_table` also renames the indexes that carry the table
# name, and `rename_column` renames the indexes that carry the column
# name. Nothing else to do.
#
# `safety_assured` — these tables are Kronk-local and pre-2.0.0 alpha
# traffic; strong_migrations would otherwise gate rename_table.
class RenameGroupsToKrews < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_table :groups, :krews

      rename_table :group_memberships, :krew_memberships
      rename_column :krew_memberships, :group_id, :krew_id

      rename_table :statuses_groups, :statuses_krews
      rename_column :statuses_krews, :group_id, :krew_id
    end
  end
end
