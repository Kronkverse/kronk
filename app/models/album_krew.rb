# frozen_string_literal: true

# Krew-scoped album join. One row per (album, krew); an album may be
# scoped to more than one krew (the composer picks a set). Only
# meaningful when `album.visibility = :krew`; the model doesn't gate
# that itself, but Album's own validation enforces "at least one row
# when scope is krew".
class AlbumKrew < ApplicationRecord
  belongs_to :album
  belongs_to :krew

  validates :krew_id, uniqueness: { scope: :album_id }
end
