# frozen_string_literal: true

# Krew-scoped album join. One row per (album, krew); an album may be
# scoped to more than one krew (the composer picks a set). Only
# meaningful when `album.visibility = :krew`; the model doesn't gate
# that itself, but Album's own validation enforces "at least one row
# when scope is krew".
#
# A Krew in an album's audience is linked to it: each row keeps a korner
# attachment beside it (Kronk::AlbumLinks), so the album and the Krew show
# each other in their Attached blocks however the Krew got there.
#
# The album's audience changed, so what follows it changes too
# (Kronk::Audience), unless the album itself is going.
class AlbumKrew < ApplicationRecord
  belongs_to :album
  belongs_to :krew

  validates :krew_id, uniqueness: { scope: :album_id }

  after_create  { Kronk::AlbumLinks.audience_added(self) }
  after_destroy { Kronk::AlbumLinks.audience_removed(self) }
  after_create  :album_audience_changed
  after_destroy :album_audience_changed, unless: -> { destroyed_by_association&.active_record == Album }

  private

  def album_audience_changed
    Kronk::Audience.changed(album)
  end
end
