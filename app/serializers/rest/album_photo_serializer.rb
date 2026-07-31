# frozen_string_literal: true

# A single photo contribution. Since 2026-07-31 an `AlbumPhoto` is a
# thin join to a `Status`; the Status is the authoritative record of
# the photo's caption, media, favourites, and replies. This serializer
# embeds the Status so clients can render the photo with the same
# components they use for any other post.
#
# `caption` and `url` are kept as top-level fields so existing
# frontends don't break in the same deploy that adds the Status
# backing — they're derived from the linked Status.
class REST::AlbumPhotoSerializer < ActiveModel::Serializer
  attributes :id, :caption, :url, :created_at

  belongs_to :contributor, serializer: REST::AccountSerializer
  belongs_to :status, serializer: REST::StatusSerializer

  def id
    object.id.to_s
  end

  def caption
    object.status&.text
  end

  def url
    object.rendered_url
  end

  def created_at
    object.created_at.iso8601
  end
end
