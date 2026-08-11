# frozen_string_literal: true

# A specific account on an album's contribution roster — the "invited"
# people who may add photos even though the album isn't open to everyone
# who can see it (docs/spaces/albutts.md). One row per (album, account).
# Distinct from AlbumPhoto#contributor_id, which records who HAS
# contributed; this records who MAY.
class AlbumContributor < ApplicationRecord
  belongs_to :album
  belongs_to :account

  validates :account_id, uniqueness: { scope: :album_id }
end
