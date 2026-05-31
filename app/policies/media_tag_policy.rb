# frozen_string_literal: true

class MediaTagPolicy < ApplicationPolicy
  def destroy?
    # Tagger or the tagged account can remove a tag
    record.created_by_account_id == current_account.id ||
      record.account_id == current_account.id
  end
end
