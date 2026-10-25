# frozen_string_literal: true

# Full Chronicle envelope — the shape returned by
# /api/v1/kronikles/chronicles (index/show/create/update). Trimmed
# shape for feed embedding lives in REST::ChronicleSummarySerializer.
class REST::ChronicleSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :id, :title, :body, :excerpt, :kind, :visibility, :created_at

  attribute :is_owner

  # The pictures the body places, for the reader to resolve
  # `![caption](picture:<id>)` against. Never a URL from the body itself.
  attribute :pictures

  belongs_to :owner, serializer: REST::AccountSerializer

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

  def pictures
    object.pictures.map do |media|
      {
        id: media.id.to_s,
        url: full_asset_url(media.file.url(:original)),
        preview_url: full_asset_url(media.file.url(:small)),
        width: media.file.meta&.dig('original', 'width'),
        height: media.file.meta&.dig('original', 'height'),
      }
    end
  end

  def excerpt
    object.excerpt
  end

  def is_owner
    return false unless current_user&.account_id

    object.owner_id == current_user.account_id
  end

  def created_at
    object.created_at.iso8601
  end
end
