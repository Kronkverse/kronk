# frozen_string_literal: true

# Kronk — repair `account_stats.mates_count`.
#
# `AddMatesCountToAccountStats` (2026-07-24) added the column with a
# default of 0 and said existing mutual pairs would be "backfilled by a
# follow-up recount". That recount never ran, so every Mate bond formed
# before the column existed counted as nothing: measured on shadow
# 2026-09-15, all 112 local accounts stored 0 while the graph held 875
# mutual pairs, and 87 accounts showed `0 Mates` on a profile whose own
# header said "You're Mates".
#
# The counter itself is sound — Follow's create/destroy callbacks were
# verified to increment and decrement both sides correctly, and every
# path that removes a follow (unfollow, block, account deletion) goes
# through `destroy`, not `delete_all`. Only the starting value was
# wrong, which is why this is a one-off repair rather than a fix to the
# maintenance code.
#
# Set-based and idempotent: re-running it is a no-op, and it is the same
# arithmetic `tootctl cache recount accounts` applies per account.
#
# `safety_assured` because strong_migrations cannot see how small this
# is — the instance has ~1,300 follow rows, so both statements are
# milliseconds. This is not a pattern to copy onto a large table.
class BackfillMatesCount < ActiveRecord::Migration[8.0]
  # A Mate is a mutual follow: a follow row whose mirror image exists.
  MUTUAL_PAIRS = <<~SQL.squish
    SELECT f1.account_id AS account_id, COUNT(*) AS mates
    FROM follows f1
    JOIN follows f2
      ON f2.account_id = f1.target_account_id
     AND f2.target_account_id = f1.account_id
    GROUP BY f1.account_id
  SQL

  def up
    safety_assured do
      # Everyone who has at least one Mate gets the true number. The
      # INSERT covers accounts that have no account_stats row yet —
      # the row is created lazily, so an account can have Mates and no
      # stats at all.
      execute(<<~SQL.squish)
        INSERT INTO account_stats (account_id, mates_count, created_at, updated_at)
        SELECT account_id, mates, now(), now()
        FROM (#{MUTUAL_PAIRS}) pairs
        ON CONFLICT (account_id)
        DO UPDATE SET mates_count = EXCLUDED.mates_count, updated_at = now()
      SQL

      # And anyone carrying a count with no mutual pair behind it goes
      # back to zero, which is the other half of "the stored number
      # equals the graph".
      execute(<<~SQL.squish)
        UPDATE account_stats
        SET mates_count = 0, updated_at = now()
        WHERE mates_count <> 0
          AND account_id NOT IN (SELECT account_id FROM (#{MUTUAL_PAIRS}) pairs)
      SQL
    end
  end

  def down
    # Deliberately irreversible: the previous values were wrong, and
    # restoring them would mean storing a number we know is a lie.
    raise ActiveRecord::IrreversibleMigration
  end
end
