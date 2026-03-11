# frozen_string_literal: true

class FriendActivity
  attr_reader :id, :activity_type, :account, :status, :created_at

  def initialize(id:, activity_type:, account:, status:, created_at:)
    @id = id
    @activity_type = activity_type
    @account = account
    @status = status
    @created_at = created_at
  end
end
