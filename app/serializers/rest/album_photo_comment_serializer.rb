# frozen_string_literal: true

class REST::AlbumPhotoCommentSerializer < ActiveModel::Serializer
  attributes :id, :album_photo_id, :parent_id, :body, :created_at

  belongs_to :account, serializer: REST::AccountSerializer

  # Only a root comment carries its replies (one level of threading), so
  # a reply's serializer never re-queries children.
  has_many :replies, serializer: REST::AlbumPhotoCommentSerializer,
                     if: -> { object.parent_id.nil? }

  def id
    object.id.to_s
  end

  def album_photo_id
    object.album_photo_id.to_s
  end

  def parent_id
    object.parent_id&.to_s
  end
end
