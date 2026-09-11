# frozen_string_literal: true

# One photo of a Kar. Not Status-backed — see KarPhoto model.
class REST::KarPhotoSerializer < ActiveModel::Serializer
  attributes :id, :caption, :position, :url, :created_at

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
