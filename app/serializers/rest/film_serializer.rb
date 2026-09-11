# frozen_string_literal: true

# Full Film envelope — the shape returned by /api/v1/cinema/films
# (index/show/create/update). Trimmed shape for feed embedding lives
# in REST::FilmSummarySerializer.
class REST::FilmSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :visibility, :created_at

  attribute :video_url
  attribute :is_owner

  belongs_to :owner, serializer: REST::AccountSerializer

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
