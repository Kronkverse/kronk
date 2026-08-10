# frozen_string_literal: true

# Collapse the profile identity-scope ladder (everyone/kronk/connections/
# vouched/only_me) onto the platform reach ladder (public/mates/orbit/
# self_only) for profile_cards + profile_sections. Decision:
# docs/rebuild/decisions.md 2026-08-09.
#
# Integer mapping (new enum: public:0, mates:1, orbit:3, self_only:4):
#   everyone(0)    -> public(0)      no-op
#   kronk(1)       -> public(0)
#   connections(2) -> mates(1)
#   vouched(3)     -> mates(1)       vouched already resolved to connections
#   only_me(4)     -> self_only(4)   no-op
#
# `everyone` cards/sections were visible to the logged-out web + fediverse;
# they become members-only (Kronkverse). A narrowing — nothing is exposed
# wider than before. Default flips from kronk(1) to public(0), the same
# members-wide audience under the new names.
class MigrateProfileVisibilityToReachLadder < ActiveRecord::Migration[8.0]
  TABLES = %i(profile_cards profile_sections).freeze

  def up
    TABLES.each do |table|
      # Bounded data backfill on small per-account tables — safe to run inline.
      safety_assured do
        execute(<<~SQL.squish)
          UPDATE #{table} SET visibility = CASE visibility
            WHEN 1 THEN 0
            WHEN 2 THEN 1
            WHEN 3 THEN 1
            ELSE visibility
          END
        SQL
      end
      change_column_default table, :visibility, from: 1, to: 0
    end
  end

  def down
    # Best-effort inverse — the kronk/vouched distinctions were lost in the
    # collapse, so public->everyone, mates->connections, orbit->connections.
    TABLES.each do |table|
      safety_assured do
        execute(<<~SQL.squish)
          UPDATE #{table} SET visibility = CASE visibility
            WHEN 1 THEN 2
            WHEN 3 THEN 2
            ELSE visibility
          END
        SQL
      end
      change_column_default table, :visibility, from: 0, to: 1
    end
  end
end
