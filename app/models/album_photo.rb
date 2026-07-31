# frozen_string_literal: true

# A single contribution to an album. As of 2026-07-31, an AlbumPhoto is
# a thin join between an `Album` and a `Status` — the Status is the
# authoritative record of the photo's caption, media, favourites, and
# reply thread. This lets an album photo behave like any other post
# (hashtag/mention parsing, edit history, alt text, mates-scoped
# visibility) without duplicating the machinery locally.
#
# Attribution lives on `contributor_id`, kept alongside the Status's
# own `account_id`. The two are the same account by construction; the
# denormal is retained because the earlier `AlbumPhoto` shape had it
# and the Kommons Directory + notifier code paths already read it.
#
# The old `media_attachment_id`, `external_url`, and `caption` columns
# remain on the table for one release so a follow-up migration can
# backfill and drop them; they are no longer written to and the model
# ignores them. Read paths pull everything through `status`.
class AlbumPhoto < ApplicationRecord
  belongs_to :album, inverse_of: :photos
  belongs_to :contributor, class_name: 'Account'
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :album_photo

  scope :chronological, -> { order(created_at: :asc) }
  scope :newest, -> { order(created_at: :desc) }

  before_destroy :destroy_status!, prepend: true

  after_commit :publish_new_photo_event, on: :create

  # The URL clients render. Prefers the Status's first media
  # attachment; falls back to nothing (a Status without media is a
  # valid but rare shape — the composer refuses to create one).
  def rendered_url
    media = status&.media_attachments&.first
    return media.file.url(:original) if media&.file.present?
    return media.remote_url if media && media.remote_url.present?

    nil
  end

  # Caption reads through Status so callers don't have to. Nil when the
  # status is missing (defensive; the join should always be populated
  # after the 2026-07-31 refactor).
  def caption
    status&.text
  end

  private

  # Destroying the photo destroys its backing status. Prepending it
  # runs before the `dependent: :nullify` cascade on Status's has_one
  # would otherwise leave a bare status behind.
  def destroy_status!
    status&.destroy
  end

  # albutts.album.new_photo — a new contribution has landed. The
  # `initializers/nudges_event_bus.rb` fan-out subscriber picks this
  # up and delivers a nudge to every fellow contributor via the
  # Mate-gated router (docs/spaces/albutts.md §Notifications).
  def publish_new_photo_event
    Kronk::KornerEvents.publish(
      'albutts.album.new_photo',
      actor_account_id: contributor_id,
      album_id: album_id,
      photo_id: id
    )
  end
end
