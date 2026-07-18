# frozen_string_literal: true

# Collapse the proposal lifecycle to four real states.
#
# Retires two values that were never lifecycle states:
#
#   vetoed (2)      — a cached boolean of "has at least one block vote",
#                     recomputed by reconcile_status! on every vote and
#                     unvote. No user ever set it. It survives as a
#                     response count off proposal_votes, which is where it
#                     always actually lived.
#   in_progress (4) — no code path anywhere in the repo ever assigned it.
#
# Both map to open. Nothing is lost: a vetoed proposal's blocks are still
# in proposal_votes, and no row was ever in_progress to begin with.
#
# Also fixes the default. The column defaulted to 0, which is not a valid
# enum value — any row written without an explicit status landed unmapped.
class CollapseProposalStates < ActiveRecord::Migration[8.0]
  OPEN = 1
  VETOED = 2
  IN_PROGRESS = 4

  def up
    say_with_time 'remapping retired proposal states to open' do
      execute <<~SQL.squish
        UPDATE proposals
           SET status = #{OPEN}
         WHERE status IN (#{VETOED}, #{IN_PROGRESS}, 0)
      SQL
    end

    change_column_default :proposals, :status, from: 0, to: OPEN
  end

  def down
    change_column_default :proposals, :status, from: OPEN, to: 0
    # The remap is not reversible: which open proposals were previously
    # vetoed is recoverable from proposal_votes, not from this column.
  end
end
