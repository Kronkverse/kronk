# frozen_string_literal: true

# Albutts contribution becomes an ADDITIVE roster (docs/spaces/albutts.md,
# 2026-08-11), mirroring the additive audience axis. "Who can add photos" is
# now: an open/restricted base + a roster of specific people AND/OR krews.
#
#   * open   — anyone who can see the album (the `contribution = open` enum
#              value already means exactly this; unchanged).
#   * else   — restricted to the roster:
#                - specific accounts  → `album_contributors` (this table; the
#                  "invited" roster that was previously a stub), and/or
#                - specific krews     → `album_krews` rows flagged
#                  `for_contribution`.
#
# A contributor krew is always also an audience krew (you must see an album to
# add to it), so contributor krews live in `album_krews` behind a flag rather
# than a second join. Audience krews are all `album_krews` rows (unchanged).
#
# Behaviour-preserving backfill: albums whose contribution was already `krew`
# (enum 3) get their existing krews flagged `for_contribution`, so their
# contributor roster is unchanged. Everything else keeps an empty roster
# (closed/invited/event all contributed owner-only before this).
class AddAdditiveContributionRostersToAlbums < ActiveRecord::Migration[8.0]
  def up
    add_column :album_krews, :for_contribution, :boolean, default: false, null: false

    create_table :album_contributors do |t|
      t.references :album, null: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end
    add_index :album_contributors, %i(album_id account_id),
              unique: true, name: 'index_album_contributors_on_album_and_account'

    safety_assured do
      execute(<<~SQL.squish)
        UPDATE album_krews SET for_contribution = true
        WHERE album_id IN (SELECT id FROM albums WHERE contribution = 3)
      SQL
    end
  end

  def down
    drop_table :album_contributors
    remove_column :album_krews, :for_contribution
  end
end
