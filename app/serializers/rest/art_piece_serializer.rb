# frozen_string_literal: true

# Full Art piece envelope — the shape returned by /api/v1/art/pieces
# (index/show/create/update). Trimmed shape for feed embedding lives
# in REST::ArtPieceSummarySerializer.
class REST::ArtPieceSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :kind, :visibility, :photo_count, :created_at
  # Piece details (docs/spaces/art.md).
  attributes :medium, :mediums, :width, :height, :depth, :size_unit, :year_made, :edition, :availability,
             :price_cents, :price_currency

  attribute :cover_url
  attribute :is_owner

  belongs_to :owner, serializer: REST::AccountSerializer
  has_many   :photos, serializer: REST::ArtPiecePhotoSerializer

  # The Krews it is for, on top of its reach (Kronk::KrewAudience), named
  # only where the viewer may see them; the same shape as an album's.
  has_many :krews, serializer: REST::KrewSerializer, if: :krews?

  def krews?
    object.record_krews.exists?
  end

  def krews
    Kronk::VisibleKrews.filter(object.krews.to_a, current_user&.account)
  end

  # "Same as": the record whose audience this one follows
  # (Kronk::Audience.leader_preview), or nil. Left out of lists.
  attribute :audience_follows, unless: -> { instance_options[:list] }

  def audience_follows
    Kronk::Audience.leader_preview(object, current_user&.account)
  end

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

  # Sizes go out as numbers, not decimal strings.
  %i(width height depth).each do |dimension|
    define_method(dimension) { object.public_send(dimension)&.to_f }
  end

  def created_at
    object.created_at.iso8601
  end
end
