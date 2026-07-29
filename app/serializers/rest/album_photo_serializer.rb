# frozen_string_literal: true

# A single photo contribution. `contributor` is always populated (a
# photo without an attributed contributor would violate Albutts's
# whole point). `url` is derived — the Mastodon MediaAttachment's
# public URL when present, else the external URL.
class REST::AlbumPhotoSerializer < ActiveModel::Serializer
  attributes :id, :caption, :url, :created_at

  belongs_to :contributor, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  def url
    object.rendered_url
  end

  def created_at
    object.created_at.iso8601
  end
end
