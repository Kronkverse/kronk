# frozen_string_literal: true

# Delete pre-2026-07-31 legacy `album_photos` rows — those with
# `status_id IS NULL`. Since the Status-backed refactor (#1028) an
# `AlbumPhoto` is a thin join to a `Status`; rows without one can't
# be rendered by the client (`ApiAlbumPhotoJSON#status` is non-null)
# and were already hidden from the API in #1106. This drops them for
# real, so the `with_status` filter on the serializers becomes a
# harmless belt over a suspenders — kept in place because shadow's
# `staging-sync.yml` occasionally fails to run migrations and we
# don't want a zombie recurrence to re-break the album page.
#
# Scope: `AlbumPhoto` shipped 2026-07-29 to the shadow line only, so
# production has no rows to lose; shadow may have a handful (test
# seed / dogfooding from the two days before #1028). Not reversible
# — the source Status those rows should have pointed at is gone.
class DropZombieAlbumPhotos < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute 'DELETE FROM album_photos WHERE status_id IS NULL'
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
