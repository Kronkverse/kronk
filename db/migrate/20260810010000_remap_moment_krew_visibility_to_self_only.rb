# frozen_string_literal: true

# Krew becomes an orthogonal audience axis for Moments (docs/rebuild/
# decisions.md 2026-08-09/10): the visibility enum drops `krew` (was integer
# 2), and existing krew Moments become `self_only` (4) while keeping their
# `krew_id`. Their audience is unchanged — owner + members of that krew — since
# krew members now see a Moment additively, regardless of its reach tier.
class RemapMomentKrewVisibilityToSelfOnly < ActiveRecord::Migration[8.0]
  def up
    # Bounded data backfill (integer remap on one column) — safe inline.
    safety_assured do
      execute('UPDATE moments SET visibility = 4 WHERE visibility = 2')
    end
  end

  def down
    # Best-effort inverse: a self_only Moment carrying a krew_id was a krew
    # Moment before the split.
    safety_assured do
      execute('UPDATE moments SET visibility = 2 WHERE visibility = 4 AND krew_id IS NOT NULL')
    end
  end
end
