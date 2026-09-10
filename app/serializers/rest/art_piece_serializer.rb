# frozen_string_literal: true

# Full Art piece envelope — the shape returned by /api/v1/art/pieces
# (index/show/create/update). Trimmed shape for feed embedding lives
# in REST::ArtPieceSummarySerializer.
class REST::ArtPieceSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :kind, :visibility, :photo_count, :created_at

  attribute :cover_url
  attribute :is_owner

  belongs_to :owner, serializer: REST::AccountSerializer
  has_many   :photos, serializer: REST::ArtPiecePhotoSerializer

  def id
    object.id.to_s
  end

  def photos
    object.photos.ordered
  end

  def cover_url
    object.cover_media_attachment&.file&.url(:small).presence ||
      object.photos.ordered.first&.rendered_url
  end

  def photo_count
    @photo_count ||= object.photos.count
  end

  def is_owner
    return false unless current_user&.account_id

    object.owner_id == current_user.account_id
  end

  def created_at
    object.created_at.iso8601
  end
end
