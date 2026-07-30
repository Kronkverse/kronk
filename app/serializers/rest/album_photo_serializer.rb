# frozen_string_literal: true

# A single photo contribution. `contributor` is always populated (a
# photo without an attributed contributor would violate Albutts's
# whole point). `url` is derived — the Mastodon MediaAttachment's
# public URL when present, else the external URL.
#
# `frothed` is per-viewer — resolved via AMS's `current_user` helper
# (the requesting User; `account_id` is on the User). No viewer → false,
# which is safe (no auth leak for anonymous callers).
class REST::AlbumPhotoSerializer < ActiveModel::Serializer
  attributes :id, :caption, :url, :created_at,
             :froths_count, :comments_count, :frothed

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

  def froths_count
    object.froths.size
  end

  def comments_count
    object.comments.size
  end

  def frothed
    return false unless current_user&.account_id

    object.froths.exists?(account_id: current_user.account_id)
  end
end
