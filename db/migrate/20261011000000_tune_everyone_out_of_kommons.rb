# frozen_string_literal: true

# Kommons is opt-in through tuning (docs/decisions.md, 2026-10-11). New
# accounts start tuned out (`feed_projection.tuned_in_by_default: false`,
# Account::KornerTuneIn); this tunes out every existing local account too.
#
# Kept tuned in: anyone already tuned out (their row stays as it is), and
# anyone who turned on "Show Kommons proposals in my feed", the switch this
# replaces — they had already opted in.
#
# The rows carry a fixed `tuned_out_at` so `down` removes only these, not a
# tune-out someone makes afterwards.
class TuneEveryoneOutOfKommons < ActiveRecord::Migration[8.0]
  MARKER = '2026-10-11 00:00:00'

  def up
    safety_assured do
      execute(<<~SQL.squish)
        INSERT INTO korner_tune_outs (account_id, korner_slug, tuned_out_at, created_at, updated_at)
        SELECT a.id, 'kommons', TIMESTAMP '#{MARKER}', NOW(), NOW()
        FROM accounts a
        LEFT JOIN users u ON u.account_id = a.id
        WHERE a.domain IS NULL
          AND a.id > 0
          AND COALESCE(u.settings, '') NOT LIKE '%"kronk.feed_show_proposals":true%'
        ON CONFLICT (account_id, korner_slug) DO NOTHING
      SQL
    end
  end

  def down
    safety_assured do
      execute("DELETE FROM korner_tune_outs WHERE korner_slug = 'kommons' AND tuned_out_at = TIMESTAMP '#{MARKER}'")
    end
  end
end
