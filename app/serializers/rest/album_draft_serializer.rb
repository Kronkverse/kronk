# frozen_string_literal: true

class REST::AlbumDraftSerializer < ActiveModel::Serializer
  attributes :id, :params, :updated_at

  has_many :media_attachments, serializer: REST::MediaAttachmentSerializer

  def id
    object.id.to_s
  end
end
