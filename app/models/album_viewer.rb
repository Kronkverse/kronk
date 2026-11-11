# frozen_string_literal: true

# Someone an album's owner chose to see it, on top of its reach and Krews
# (docs/spaces/albutts.md, Who can see an album). One row per (album,
# account). Albutts::Viewers keeps the list and the album's posts together.
class AlbumViewer < ApplicationRecord
  belongs_to :album
  belongs_to :account

  validates :account_id, uniqueness: { scope: :album_id }
end
