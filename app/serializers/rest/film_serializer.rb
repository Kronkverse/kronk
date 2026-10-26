# frozen_string_literal: true

# Full Film envelope — the shape returned by /api/v1/cinema/films
# (index/show/create/update). Trimmed shape for feed embedding lives
# in REST::FilmSummarySerializer.
class REST::FilmSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :visibility, :created_at

  attribute :video_url
  attribute :is_owner

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

  def video_url
    object.video_url
  end

  def is_owner
    return false unless current_user&.account_id

    object.owner_id == current_user.account_id
  end

  def created_at
    object.created_at.iso8601
  end
end
