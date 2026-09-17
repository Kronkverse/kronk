# frozen_string_literal: true

# Krew becomes an orthogonal audience axis for Statuses (docs/rebuild/
# decisions.md 2026-08-09/10 + docs/rebuild/krew_axis_migration.md),
# matching the Moment and Album migrations. The visibility enum drops
# `krew` (was integer 5); existing krew Statuses become `self_only` (8)
# while keeping their `statuses_krews` join rows. Audience is unchanged —
# owner + members of those krews — because a krew member now sees a status
# additively (StatusPolicy#show?, FanOutOnWriteService), regardless of its
# reach tier. The 5 slot is left empty rather than renumbered.
class RemapStatusKrewVisibilityToSelfOnly < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute('UPDATE statuses SET visibility = 8 WHERE visibility = 5')
    end
  end

  def down
    # Best-effort inverse: a self_only status carrying krews was a krew
    # status before the split.
    safety_assured do
      execute(<<~SQL.squish)
        UPDATE statuses SET visibility = 5
        WHERE visibility = 8
          AND EXISTS (SELECT 1 FROM statuses_krews WHERE statuses_krews.status_id = statuses.id)
      SQL
    end
  end
end
