# frozen_string_literal: true

# A hidden post (an album photo's, a Moment's, a legacy Kuestion answer's;
# Status::KRONK_BACKING_POST_TYPES) is no longer one of its author's posts
# (docs/decisions.md, 2026-10-19), so Status stops counting it in
# `statuses_count`. This takes the ones already counted off each author's
# count, the same posts the counter cache counted: kept and not direct.
class StopCountingHiddenPosts < ActiveRecord::Migration[8.0]
  # Status.post_types: answer 2, album_photo 4, moment 5. Status.visibilities: direct 3.
  HIDDEN_POST_TYPES = '2, 4, 5'
  DIRECT = 3

  def up
    adjust('-')
  end

  def down
    adjust('+')
  end

  private

  def adjust(sign)
    safety_assured do
      execute(<<~SQL.squish)
        UPDATE account_stats
        SET statuses_count = GREATEST(0, account_stats.statuses_count #{sign} hidden.n), updated_at = NOW()
        FROM (
          SELECT account_id, COUNT(*) AS n
          FROM statuses
          WHERE post_type IN (#{HIDDEN_POST_TYPES})
            AND deleted_at IS NULL
            AND visibility <> #{DIRECT}
          GROUP BY account_id
        ) AS hidden
        WHERE account_stats.account_id = hidden.account_id
      SQL
    end
  end
end
