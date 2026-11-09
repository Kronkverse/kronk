# frozen_string_literal: true

# Comments on Mates, Orbit and Just-me posts were never counted (only public
# ones were), so those posts' comment sections never loaded. Recount every
# post's comments the way Status#increment_counter_caches now does: all but
# direct ones, as `tootctl cache recount statuses` already counted them.
class RecountCommentsOnNonPublicPosts < ActiveRecord::Migration[8.1]
  def up
    # Only fills in counts; no schema change to lock against.
    safety_assured do
      execute <<~SQL.squish
        INSERT INTO status_stats (status_id, replies_count, created_at, updated_at)
        SELECT in_reply_to_id, COUNT(*), NOW(), NOW()
        FROM statuses
        WHERE in_reply_to_id IS NOT NULL
          AND deleted_at IS NULL
          AND visibility <> 3
          AND EXISTS (SELECT 1 FROM statuses parents WHERE parents.id = statuses.in_reply_to_id)
        GROUP BY in_reply_to_id
        ON CONFLICT (status_id) DO UPDATE
          SET replies_count = EXCLUDED.replies_count, updated_at = NOW()
          WHERE status_stats.replies_count <> EXCLUDED.replies_count
      SQL
    end
  end

  def down; end
end
