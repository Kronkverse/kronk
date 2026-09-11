# frozen_string_literal: true

# Full Kar envelope — the shape returned by /api/v1/karporn/kars
# (index/show/create/update). Trimmed shape for feed embedding lives in
# REST::KarSummarySerializer.
class REST::KarSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :year, :make, :model, :visibility, :photo_count, :created_at
  attribute :cover_url
  attribute :is_owner
  attribute :location

  belongs_to :owner, serializer: REST::AccountSerializer
  has_many   :photos, serializer: REST::KarPhotoSerializer

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

  # Nil when unset, otherwise a compact { lat, lng, label } shape. Lat +
  # lng ride as floats — decimal(9,6) fits inside JSON number precision.
  def location
    return nil unless object.location? || object.location_label.present?

    {
      lat: object.location_lat&.to_f,
      lng: object.location_lng&.to_f,
      label: object.location_label,
    }.compact
  end
end
