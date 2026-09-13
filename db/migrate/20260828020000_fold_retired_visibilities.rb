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
#   limited  (4) -> mates     (6)
#
# `direct` (3) is deliberately NOT folded here — see below.
#
# The enum slot integers stay as-is (no renumbering — that would rewrite
# every row); Phase 2b just stops declaring the retired names in Ruby.
# Same pattern as the krew retirement (#20260810030000).
#
# ── `direct` is left alone (amended 2026-09-13, before this ever ran on
# production) ──────────────────────────────────────────────────────────
#
# This originally mapped direct -> mates with the rest. That is safe on an
# instance with no history and wrong on one with any: a direct status is
# visible to the author and the accounts mentioned in it, and `mates` is
# visible to every mutual the author has. Folding it widens old private
# messages to an audience that was never party to them, and drops the person
# it was actually sent to unless they happen to be a mate.
#
# The live instance holds 161 of them, the newest a week old, so they are
# conversations rather than residue. They are migrated into the messenger
# instead, by `ImportLegacyDirectMessages`, which runs after this and sets
# each one to self_only once its contents are safely across.
#
# Amending an applied migration is normally off-limits. It is safe here and
# only here: this has run on shadow and nowhere else, shadow holds zero
# direct statuses (checked), and production has never run it. Re-running is
# not required anywhere.
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
          WHEN 4 THEN 6
          ELSE visibility
        END
        WHERE visibility IN (1, 2, 4)
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
          'private and limited both folded to mates — no discriminator to ' \
          'distinguish them on the way back. Restore from backup if a ' \
          'roll-back is genuinely needed.'
  end
end
