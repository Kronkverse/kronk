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
  # A kar's own pin or label wins (older kars, the Android app); without
  # one, its Konnected Place (Kronk::RecordPlace), labelled with its name.
  def location
    return own_location if object.location? || object.location_label.present?

    place = object.konnected_place
    return nil if place.nil?

    { lat: place.latitude&.to_f, lng: place.longitude&.to_f, label: place.name }.compact
  end

  private

  def own_location
    {
      lat: object.location_lat&.to_f,
      lng: object.location_lng&.to_f,
      label: object.location_label,
    }.compact
  end
end
