# frozen_string_literal: true

class MediaTagPolicy < ApplicationPolicy
  def destroy?
    record.created_by_account_id == current_account.id ||
      record.account_id == current_account.id ||
      record.media_attachment.account_id == current_account.id
  end
end
