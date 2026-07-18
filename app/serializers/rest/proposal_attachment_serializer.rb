# frozen_string_literal: true

class REST::ProposalAttachmentSerializer < ActiveModel::Serializer
  attributes :id, :kind, :description, :filename, :content_type, :byte_size,
             :download_url, :created_at

  attribute :uploaded_by

  def id
    object.id.to_s
  end

  def content_type
    object.file_content_type
  end

  def download_url
    api_v1_proposal_attachment_url(object.proposal_id, object)
  end

  def uploaded_by
    { id: object.account_id.to_s, username: object.account.username }
  end
end
