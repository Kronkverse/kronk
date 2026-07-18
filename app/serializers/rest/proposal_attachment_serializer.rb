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

  # Built as a plain path, not a route helper. ActiveModel::Serializer does
  # not mix in Rails URL helpers, so api_v1_proposal_attachment_url raised
  # NoMethodError and 500'd the response *after* the file had already been
  # saved — the upload succeeded while the UI reported failure.
  def download_url
    "/api/v1/proposals/#{object.proposal_id}/attachments/#{object.id}"
  end

  def uploaded_by
    { id: object.account_id.to_s, username: object.account.username }
  end
end
