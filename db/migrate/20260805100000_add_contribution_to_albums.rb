# frozen_string_literal: true

# Kronk Scope Picker rollout — Albutts is the first korner. Splits
# `Album#visibility` (who can SEE) from `Album#contribution` (who
# can ADD), per docs/kronk_scope_picker.md.
#
# The enum values match the ContributionRoster type in
# `components/scope_picker.tsx` — open / closed / invited / krew /
# event. Only `open` and `closed` are wired through the composer
# in this first pass; invited / krew (as a contribution roster) /
# event land in follow-up PRs when their sub-picker UIs + backing
# infrastructure land.
#
# Migration policy for EXISTING albums: default them to `closed`
# (owner-only contribution). Aggressive default per Tal (2026-08-05)
# because the current "open-follows-visibility" behaviour was a
# surprise footgun (@george couldn't figure out why his uploads to
# @tal's mates-scoped album were failing; the album's implicit
# contribution model was the answer, and Tal didn't want that
# implicit anymore). Owners can flip existing albums to `open`
# once they see the new picker.
class AddContributionToAlbums < ActiveRecord::Migration[8.0]
  def up
    # Nullable at first — the model default of `closed` won't
    # apply to rows the migration itself creates during
    # backfill, so we set the column value explicitly below.
    add_column :albums, :contribution, :integer

    # Backfill every existing row to `closed` (enum value 1 per
    # the enum declaration in `Album`). Owners actively open
    # albums up via the composer edit path once the UX ships.
    safety_assured do
      execute <<~SQL.squish
        UPDATE albums SET contribution = 1 WHERE contribution IS NULL
      SQL
    end

    # Now enforce NOT NULL + default for new rows.
    change_column_null    :albums, :contribution, false
    change_column_default :albums, :contribution, from: nil, to: 0

    add_index :albums, :contribution
  end

  def down
    remove_index  :albums, :contribution
    remove_column :albums, :contribution
  end
end
