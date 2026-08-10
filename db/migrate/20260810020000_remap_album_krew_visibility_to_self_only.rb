# frozen_string_literal: true

# Krew becomes an orthogonal audience axis for Albums (docs/rebuild/
# decisions.md 2026-08-09/10), matching the Moment migration. The visibility
# enum drops `krew` (was integer 2); existing krew Albums become `self_only`
# (4) while keeping their `album_krews`. Audience is unchanged — owner +
# members of those krews — since krew members now see an Album additively,
# regardless of its reach tier.
class RemapAlbumKrewVisibilityToSelfOnly < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute('UPDATE albums SET visibility = 4 WHERE visibility = 2')
    end
  end

  def down
    # Best-effort inverse: a self_only Album carrying krews was a krew Album
    # before the split.
    safety_assured do
      execute(<<~SQL.squish)
        UPDATE albums SET visibility = 2
        WHERE visibility = 4
          AND EXISTS (SELECT 1 FROM album_krews WHERE album_krews.album_id = albums.id)
      SQL
    end
  end
end
