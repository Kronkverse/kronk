# frozen_string_literal: true

# Path B, Phase 2a — fold the Mastodon follower-model visibilities into
# the Kronk reach ladder at the DB layer. Kronk is unfederated through
# 2.0.0, so `unlisted` / `private` / `direct` / `limited` no longer map
# onto how reach works here; the composer stopped offering them in
# Phase 1B (#1423). This migration collapses existing rows so Phase 2b
# can safely narrow the enum on the Ruby side.
#
# Mapping (matches components/visibility_icon.tsx Phase 1 aliases +
# compose reducer's REACH_MAP — Tal's mapping):
#   unlisted (1) -> self_only (8)
#   private  (2) -> mates     (6)
#   direct   (3) -> mates     (6)
#   limited  (4) -> mates     (6)
#
# The enum slot integers stay as-is (no renumbering — that would rewrite
# every row); Phase 2b just stops declaring the retired names in Ruby.
# Same pattern as the krew retirement (#20260810030000).
#
# Tables touched:
#   statuses.visibility      — bulk UPDATE, integer enum
#   users.settings           — text column of Oj-serialized JSON; string
#                              substitution scoped to the exact
#                              `"default_privacy":"<value>"` pattern.
#                              No other setting takes those strings, so
#                              the substring is unambiguous.
#
# Not reversible: three source values (private/direct/limited) fold onto
# one target (mates), and we don't have a discriminator to un-collapse
# them. `down` raises rather than pretending.
class FoldRetiredVisibilities < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute(<<~SQL.squish)
        UPDATE statuses SET visibility = CASE visibility
          WHEN 1 THEN 8
          WHEN 2 THEN 6
          WHEN 3 THEN 6
          WHEN 4 THEN 6
          ELSE visibility
        END
        WHERE visibility IN (1, 2, 3, 4)
      SQL

      execute(<<~SQL.squish)
        UPDATE users
        SET settings = REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(settings,
                '"default_privacy":"unlisted"', '"default_privacy":"self_only"'),
              '"default_privacy":"private"', '"default_privacy":"mates"'),
            '"default_privacy":"direct"', '"default_privacy":"mates"'),
          '"default_privacy":"limited"', '"default_privacy":"mates"')
        WHERE settings LIKE '%"default_privacy":"unlisted"%'
           OR settings LIKE '%"default_privacy":"private"%'
           OR settings LIKE '%"default_privacy":"direct"%'
           OR settings LIKE '%"default_privacy":"limited"%'
      SQL
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
          'private/direct/limited all folded to mates — no discriminator ' \
          'to distinguish them on the way back. Restore from backup if a ' \
          'roll-back is genuinely needed.'
  end
end
