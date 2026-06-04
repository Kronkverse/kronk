# frozen_string_literal: true

class REST::TaggedMediaSerializer < REST::MediaAttachmentSerializer
  attribute :status_id
  attribute :status_account_acct

  def status_id
    object.status_id.to_s
  end

  def status_account_acct
    object.status&.account&.acct
  end
end
