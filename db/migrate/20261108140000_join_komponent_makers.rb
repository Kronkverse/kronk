# frozen_string_literal: true

# Whoever made a Komponent is in it (Kommons "Join Button", 2026-11-08):
# new Komponents add their maker as they're made (Project#join_gang_owner!),
# and this puts the makers of the ones that already exist in theirs. A
# Komponent is a project whose parent is its root.
class JoinKomponentMakers < ActiveRecord::Migration[8.0]
  # Data only: one row per Komponent at most, no schema change.
  def up
    safety_assured do
      execute <<~SQL.squish
        INSERT INTO freethedream_gang_members (project_id, account_id, created_at, updated_at)
        SELECT id, owner_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM freethedream_projects
        WHERE parent_id IS NOT NULL AND parent_id = root_id AND owner_id IS NOT NULL
        ON CONFLICT (project_id, account_id) DO NOTHING
      SQL
    end
  end

  def down
    # Left in place: a maker who joined is indistinguishable from one added
    # here, and leaving is one tap.
  end
end
