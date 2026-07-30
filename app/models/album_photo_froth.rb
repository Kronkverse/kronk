# frozen_string_literal: true

# A single Froth on a single photo — the "like" for photos inside an
# Albutt. One row per (photo, account); toggled by POST/DELETE on the
# nested froth endpoint. Uniqueness is enforced by the DB (see the
# create_album_photo_reactions migration); the model validation just
# gives a cleaner error to the controller side.
class AlbumPhotoFroth < ApplicationRecord
  belongs_to :album_photo, inverse_of: :froths
  belongs_to :account

  validates :account_id, uniqueness: { scope: :album_photo_id }

  after_commit :publish_frothed_event, on: :create

  private

  # albutts.photo.frothed — the nudges event bus picks this up and
  # delivers a nudge to the photo's contributor (docs/spaces/albutts.md
  # §Notifications). The Mate gate applies per recipient.
  def publish_frothed_event
    Kronk::KornerEvents.publish(
      'albutts.photo.frothed',
      actor_account_id: account_id,
      album_id: album_photo.album_id,
      photo_id: album_photo_id,
      contributor_account_id: album_photo.contributor_id
    )
  end
end
