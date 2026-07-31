# frozen_string_literal: true

# A single contribution to an album. Attribution lives on
# `contributor_id`, deliberately named so `album_photo.contributor`
# reads naturally and never gets confused with the album's `owner`.
#
# Storage is one of two mutually exclusive paths, enforced by a DB
# check constraint (see the migration):
#
#   * `media_attachment_id` — the MVP path. The contributor uploaded
#     via Mastodon `POST /api/v1/media`; MediaAttachment already
#     `belongs_to :account`, so the attribution chain is unambiguous.
#     If the contributor's attachment is later vacuumed or deleted,
#     the FK nulls out and the album's render of that photo goes dark
#     (matching the spec's one-sided-revocation invariant).
#
#   * `external_url` — schema-ready for the Anthemos era when
#     contributors host media on their own pod. Not exercised by the
#     v1 composer.
#
# See docs/spaces/albutts.md §Storage.
class AlbumPhoto < ApplicationRecord
  belongs_to :album, inverse_of: :photos
  belongs_to :contributor, class_name: 'Account'
  belongs_to :media_attachment, optional: true

  has_many :froths,   class_name: 'AlbumPhotoFroth',   dependent: :destroy, inverse_of: :album_photo
  has_many :comments, class_name: 'AlbumPhotoComment', dependent: :destroy, inverse_of: :album_photo

  validates :caption, length: { maximum: 500 }, allow_blank: true
  validate  :exactly_one_media_source
  validate  :media_attachment_belongs_to_contributor

  scope :chronological, -> { order(created_at: :asc) }
  scope :newest, -> { order(created_at: :desc) }

  after_commit :publish_new_photo_event, on: :create

  # The URL clients render. Prefers the Mastodon attachment's public
  # URL; falls back to the raw external URL. Nil if both sources are
  # missing (shouldn't happen — the check constraint prevents it — but
  # a defensive nil beats a crash).
  def rendered_url
    return media_attachment.file.url(:original) if media_attachment&.file.present?
    return media_attachment.remote_url if media_attachment && media_attachment.remote_url.present?

    external_url.presence
  end

  private

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

  def exactly_one_media_source
    has_attachment = media_attachment_id.present?
    has_url = external_url.present?
    return if has_attachment ^ has_url # xor — exactly one

    errors.add(:base, 'album photo must have either a media attachment or an external URL, not both')
  end

  # The uploader must be the same account that owns the attachment;
  # otherwise the attribution promise breaks down.
  def media_attachment_belongs_to_contributor
    return if media_attachment_id.blank?
    return if media_attachment && media_attachment.account_id == contributor_id

    errors.add(:media_attachment, 'must belong to the contributor')
  end
end
